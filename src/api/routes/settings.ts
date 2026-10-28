import type { FastifyInstance } from "fastify";
import { registerSecuritySettingsRoutes } from "./settings/securitySettingsRoutes.js";
import { registerPmConfigRoutes } from "./settings/pmConfigRoutes.js";

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
    registerSecuritySettingsRoutes(app);
    registerPmConfigRoutes(app);
}
