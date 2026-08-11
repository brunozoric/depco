import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerSecuritySettingsQueryRoutes } from "./securitySettings/securitySettingsQueryRoutes.js";
import { registerSecuritySettingsActionRoutes } from "./securitySettings/securitySettingsActionRoutes.js";

export function registerSecuritySettingsRoutes(app: FastifyInstance, container: Container): void {
    registerSecuritySettingsQueryRoutes(app, container);
    registerSecuritySettingsActionRoutes(app, container);
}
