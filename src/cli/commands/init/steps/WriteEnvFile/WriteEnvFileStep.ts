import { existsSync, writeFileSync, rmSync } from "node:fs";
import { WriteEnvFileStep as Abstraction } from "./abstractions/WriteEnvFileStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class WriteEnvFileStepImpl implements Abstraction.Interface {
    public name = "write-env-file";
    public description = "Write .env configuration file";

    public async execute(context: IStepContext): Promise<IStepResult> {
        if (existsSync(context.envFilePath)) {
            return { success: true, skipped: true, message: ".env already exists" };
        }

        const encryptionKey = context.results.get("encryptionKey") as string;
        const port = context.results.get("port") as string;
        const dbPath = context.results.get("dbPath") as string;

        const content = [
            `ENCRYPTION_KEY=${encryptionKey}`,
            `PORT=${port}`,
            `DB_PATH=${dbPath}`,
            ""
        ].join("\n");

        writeFileSync(context.envFilePath, content, { mode: 0o600 });
        return { success: true };
    }

    public async rollback(context: IStepContext): Promise<void> {
        if (existsSync(context.envFilePath)) {
            rmSync(context.envFilePath);
        }
    }
}

export const WriteEnvFileStep = Abstraction.createImplementation({
    implementation: WriteEnvFileStepImpl,
    dependencies: []
});
