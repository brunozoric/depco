import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Logger } from "@webiny/stdlib";
import { ValidateConfigStep as Abstraction } from "./abstractions/ValidateConfigStep.js";
import { depcoConfigSchema } from "#shared/config/schema.js";
import { getErrorMessage } from "#shared/errors.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class ValidateConfigStepImpl implements Abstraction.Interface {
    public name = "validate-config";
    public description = "Validate depco.config.ts";

    public constructor(private readonly logger: Logger.Interface) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const configPath = join(context.dataDirectory, "depco.config.ts");

        if (!existsSync(configPath)) {
            this.logger.info("No depco.config.ts found in current directory");
            return {
                success: true,
                skipped: true,
                message: "no depco.config.ts found"
            };
        }

        let raw: unknown;
        try {
            const module = (await import(pathToFileURL(configPath).href)) as Record<
                string,
                unknown
            >;
            raw = module["default"];
        } catch (error) {
            const message = getErrorMessage(error, String(error));
            this.logger.error(`Failed to load depco.config.ts: ${message}`);
            return { success: false, message: `Failed to load depco.config.ts: ${message}` };
        }

        const result = depcoConfigSchema.safeParse(raw);
        if (!result.success) {
            this.logger.error("depco.config.ts is invalid:");
            for (const issue of result.error.issues) {
                const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
                this.logger.error(`  ${path}: ${issue.message}`);
            }
            return { success: false, message: "depco.config.ts is invalid" };
        }

        this.logger.info("depco.config.ts is valid");
        return { success: true, message: "depco.config.ts is valid" };
    }
}

export const ValidateConfigStep = Abstraction.createImplementation({
    implementation: ValidateConfigStepImpl,
    dependencies: [Logger]
});
