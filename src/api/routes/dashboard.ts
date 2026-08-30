import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerDashboardHealthRoutes } from "./dashboard/dashboardHealthRoutes.js";
import { registerDashboardTrendRoutes } from "./dashboard/dashboardTrendRoutes.js";
import { registerDashboardStatusRoutes } from "./dashboard/dashboardStatusRoutes.js";

export async function dashboardRoutes(
    app: FastifyInstance,
    options: IPluginOptions
): Promise<void> {
    const { container } = options;
    registerDashboardHealthRoutes(app, container);
    registerDashboardTrendRoutes(app, container);
    registerDashboardStatusRoutes(app, container);
}
