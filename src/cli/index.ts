#!/usr/bin/env node
import { register } from "tsx/esm/api";
register();

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createContainer, registerFeatures } from "#shared/index.js";
import { CliFeature } from "./feature.js";
import { InitCommand } from "./commands/init/index.js";
import { StartCommand } from "./commands/start/index.js";
import { ScanCommand } from "./commands/scan/index.js";
import { StepRunner } from "./runner/index.js";

const container = createContainer();
registerFeatures(container, [CliFeature]);

const runner = container.resolve(StepRunner);

let cli = yargs(hideBin(process.argv));

cli = cli.command("init", "Initialize depco", {}, async () => {
    const command = container.resolve(InitCommand);
    await runner.run({ steps: command.steps(), context: command.context() });
});

cli = cli.command("start", "Start the depco server", {}, async () => {
    const command = container.resolve(StartCommand);
    await runner.run({ steps: command.steps(), context: command.context() });
});

cli = cli.command(
    "scan",
    "Scan current directory for dependency issues",
    yargs =>
        yargs
            .option("check", {
                type: "string",
                description: "Check to run",
                default: "license",
                choices: ["license", "vulnerability", "all"]
            })
            .option("format", {
                type: "string",
                description: "Output format",
                default: "table",
                choices: ["table", "json", "csv", "sarif"]
            }),
    async argv => {
        const command = container.resolve(ScanCommand);
        await runner.run({ steps: command.steps(), context: command.context(argv) });
    }
);

cli.demandCommand(1, "Please specify a command: init, start, or scan")
    .strict()
    .help()
    .parseAsync()
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
