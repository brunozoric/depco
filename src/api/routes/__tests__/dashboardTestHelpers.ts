import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { dashboardRoutes } from "../dashboard.js";

export interface DashboardTestContext {
    app: FastifyInstance;
    db: ReturnType<typeof createTestApiContainer>["db"];
}

export async function setupDashboardTest(): Promise<DashboardTestContext> {
    const result = createTestApiContainer();
    const db = result.db;
    const app = Fastify();
    await app.register(dashboardRoutes, { container: result.container });
    await app.ready();
    return { app, db };
}

export async function teardownDashboardTest(context: DashboardTestContext): Promise<void> {
    await context.app.close();
}
