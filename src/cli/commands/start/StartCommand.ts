import { StartCommand as Abstraction } from "./abstractions/StartCommand.js";
import { ValidateEnvironmentStep } from "./steps/ValidateEnvironment/index.js";
import { StartServerStep } from "./steps/StartServer/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

class StartCommandImpl implements Abstraction.Interface {
    public name = "start";
    public description = "Start the depco server";

    public constructor(
        private validateEnvironment: Step.Interface,
        private startServer: Step.Interface
    ) {}

    public steps(): Step.Interface[] {
        return [this.validateEnvironment, this.startServer];
    }

    public context(): Step.Context {
        return {
            dataDirectory: "./data",
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
    }
}

export const StartCommand = Abstraction.createImplementation({
    implementation: StartCommandImpl,
    dependencies: [ValidateEnvironmentStep, StartServerStep]
});
