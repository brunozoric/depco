import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerVulnerabilityQueryRoutes } from "./vulnerabilities/vulnerabilityQueryRoutes.js";
import { registerVulnerabilityActionRoutes } from "./vulnerabilities/vulnerabilityActionRoutes.js";

export async function vulnerabilityRoutes(
    app: FastifyInstance,
    options: IPluginOptions
): Promise<void> {
    const { container } = options;
    registerVulnerabilityQueryRoutes(app, container);
    registerVulnerabilityActionRoutes(app, container);
}
