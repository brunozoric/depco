import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerDashboardHealthRoutes } from "./dashboard/dashboardHealthRoutes.js";
import { registerDashboardTrendRoutes } from "./dashboard/dashboardTrendRoutes.js";
import { registerDashboardStatusRoutes } from "./dashboard/dashboardStatusRoutes.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function dashboardRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    registerDashboardHealthRoutes(app, container);
    registerDashboardTrendRoutes(app, container);
    registerDashboardStatusRoutes(app, container);
}
