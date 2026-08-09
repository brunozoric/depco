import { existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { EnsureDataDirectoryStep as Abstraction } from "./abstractions/EnsureDataDirectoryStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class EnsureDataDirectoryStepImpl implements Abstraction.Interface {
    public name = "ensure-data-directory";
    public description = "Ensure data directory exists";

    public async execute(context: IStepContext): Promise<IStepResult> {
        if (existsSync(context.dataDirectory)) {
            return { success: true, skipped: true, message: "data directory already exists" };
        }
        mkdirSync(context.dataDirectory, { recursive: true });
        return { success: true };
    }

    public async rollback(context: IStepContext): Promise<void> {
        if (existsSync(context.dataDirectory)) {
            const entries = readdirSync(context.dataDirectory);
            if (entries.length === 0) {
                rmSync(context.dataDirectory, { recursive: true });
            }
        }
    }
}

export const EnsureDataDirectoryStep = Abstraction.createImplementation({
    implementation: EnsureDataDirectoryStepImpl,
    dependencies: []
});
