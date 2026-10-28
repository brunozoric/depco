import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { dashboardRoutes } from "../dashboard.js";
import { registerRequestContainer } from "#api/middleware/requestContainer.js";

export interface DashboardTestContext {
    app: FastifyInstance;
    db: ReturnType<typeof createTestApiContainer>["db"];
}

export async function setupDashboardTest(): Promise<DashboardTestContext> {
    const result = createTestApiContainer();
    const db = result.db;
    const app = Fastify();
    registerRequestContainer(app, result.container);
    await app.register(dashboardRoutes);
    await app.ready();
    return { app, db };
}

export async function teardownDashboardTest(context: DashboardTestContext): Promise<void> {
    await context.app.close();
}
