import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { LoadConfigStep as Abstraction } from "./abstractions/LoadConfigStep.js";
import { depcoConfigSchema } from "#shared/config/schema.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

class LoadConfigStepImpl implements Abstraction.Interface {
    public name = "load-config";
    public description = "Load depco.config.ts";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const configPath = join(context.dataDirectory, "depco.config.ts");

        if (!existsSync(configPath)) {
            context.results.set("config", {});
            return {
                success: true,
                skipped: true,
                message: "no depco.config.ts found, using defaults"
            };
        }

        try {
            const module = (await import(pathToFileURL(configPath).href)) as Record<
                string,
                unknown
            >;
            const raw = module["default"];
            const config = depcoConfigSchema.parse(raw);
            context.results.set("config", config);
            return { success: true, message: "loaded depco.config.ts" };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, message: `Invalid depco.config.ts: ${message}` };
        }
    }
}

export const LoadConfigStep = Abstraction.createImplementation({
    implementation: LoadConfigStepImpl,
    dependencies: []
});
