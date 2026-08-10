import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerLicenseQueryRoutes } from "./licenses/licenseQueryRoutes.js";
import { registerLicenseViolationRoutes } from "./licenses/licenseViolationRoutes.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function licenseRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    registerLicenseQueryRoutes(app, container);
    registerLicenseViolationRoutes(app, container);
}
