import type { FastifyInstance } from "fastify";
import { registerLicenseQueryRoutes } from "./licenses/licenseQueryRoutes.js";
import { registerLicenseViolationRoutes } from "./licenses/licenseViolationRoutes.js";

export async function licenseRoutes(app: FastifyInstance): Promise<void> {
    registerLicenseQueryRoutes(app);
    registerLicenseViolationRoutes(app);
}
