import type { FastifyInstance } from "fastify";
import { registerVulnerabilityQueryRoutes } from "./vulnerabilities/vulnerabilityQueryRoutes.js";
import { registerVulnerabilityActionRoutes } from "./vulnerabilities/vulnerabilityActionRoutes.js";

export async function vulnerabilityRoutes(app: FastifyInstance): Promise<void> {
    registerVulnerabilityQueryRoutes(app);
    registerVulnerabilityActionRoutes(app);
}
