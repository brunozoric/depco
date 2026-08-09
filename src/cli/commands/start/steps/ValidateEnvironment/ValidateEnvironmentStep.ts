import { existsSync, readFileSync } from "node:fs";
import { ValidateEnvironmentStep as Abstraction } from "./abstractions/ValidateEnvironmentStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class ValidateEnvironmentStepImpl implements Abstraction.Interface {
    public name = "validate-environment";
    public description = "Validate environment configuration";

    public async execute(context: IStepContext): Promise<IStepResult> {
        if (!existsSync(context.envFilePath)) {
            return {
                success: false,
                message: `.env not found at ${context.envFilePath} — run 'depco init' first`
            };
        }

        const content = readFileSync(context.envFilePath, "utf-8");
        if (!content.includes("ENCRYPTION_KEY=")) {
            return { success: false, message: "ENCRYPTION_KEY missing from .env" };
        }

        return { success: true };
    }
}

export const ValidateEnvironmentStep = Abstraction.createImplementation({
    implementation: ValidateEnvironmentStepImpl,
    dependencies: []
});
