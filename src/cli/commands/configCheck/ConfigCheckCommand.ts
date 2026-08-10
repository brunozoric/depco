import { ConfigCheckCommand as Abstraction } from "./abstractions/ConfigCheckCommand.js";
import { ValidateConfigStep } from "./steps/ValidateConfig/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

class ConfigCheckCommandImpl implements Abstraction.Interface {
    public name = "config-check";
    public description = "Validate depco.config.ts without running a scan";

    public constructor(private validateConfig: Step.Interface) {}

    public steps(): Step.Interface[] {
        return [this.validateConfig];
    }

    public context(): Step.Context {
        return {
            dataDirectory: process.cwd(),
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
    }
}

export const ConfigCheckCommand = Abstraction.createImplementation({
    implementation: ConfigCheckCommandImpl,
    dependencies: [ValidateConfigStep]
});
