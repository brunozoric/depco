import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerSecuritySettingsRoutes } from "./settings/securitySettingsRoutes.js";
import { registerPmConfigRoutes } from "./settings/pmConfigRoutes.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function settingsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    registerSecuritySettingsRoutes(app, container);
    registerPmConfigRoutes(app, container);
}
