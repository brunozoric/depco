import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerVulnerabilityQueryRoutes } from "./vulnerabilities/vulnerabilityQueryRoutes.js";
import { registerVulnerabilityActionRoutes } from "./vulnerabilities/vulnerabilityActionRoutes.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function vulnerabilityRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    registerVulnerabilityQueryRoutes(app, container);
    registerVulnerabilityActionRoutes(app, container);
}
