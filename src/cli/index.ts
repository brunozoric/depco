#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createContainer, registerFeatures } from "#shared/index.js";
import { CliFeature } from "./feature.js";
import { InitCommand } from "./commands/init/index.js";
import { StartCommand } from "./commands/start/index.js";
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

cli.help().parse();
