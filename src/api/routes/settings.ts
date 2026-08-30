import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerSecuritySettingsRoutes } from "./settings/securitySettingsRoutes.js";
import { registerPmConfigRoutes } from "./settings/pmConfigRoutes.js";

export async function settingsRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;
    registerSecuritySettingsRoutes(app, container);
    registerPmConfigRoutes(app, container);
}
