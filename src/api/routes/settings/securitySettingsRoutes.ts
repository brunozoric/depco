import type { FastifyInstance } from "fastify";
import { registerSecuritySettingsQueryRoutes } from "./securitySettings/securitySettingsQueryRoutes.js";
import { registerSecuritySettingsActionRoutes } from "./securitySettings/securitySettingsActionRoutes.js";

export function registerSecuritySettingsRoutes(app: FastifyInstance): void {
    registerSecuritySettingsQueryRoutes(app);
    registerSecuritySettingsActionRoutes(app);
}
