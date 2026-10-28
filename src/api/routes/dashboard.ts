import type { FastifyInstance } from "fastify";
import { registerDashboardHealthRoutes } from "./dashboard/dashboardHealthRoutes.js";
import { registerDashboardTrendRoutes } from "./dashboard/dashboardTrendRoutes.js";
import { registerDashboardStatusRoutes } from "./dashboard/dashboardStatusRoutes.js";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
    registerDashboardHealthRoutes(app);
    registerDashboardTrendRoutes(app);
    registerDashboardStatusRoutes(app);
}
