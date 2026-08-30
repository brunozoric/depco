import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerLicenseQueryRoutes } from "./licenses/licenseQueryRoutes.js";
import { registerLicenseViolationRoutes } from "./licenses/licenseViolationRoutes.js";

export async function licenseRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;
    registerLicenseQueryRoutes(app, container);
    registerLicenseViolationRoutes(app, container);
}
