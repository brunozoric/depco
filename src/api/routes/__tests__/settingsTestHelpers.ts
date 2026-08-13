import { rm } from "node:fs/promises";
import { join } from "node:path";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { settingsRoutes } from "../settings.js";

export type TestDb = ReturnType<typeof createTestApiContainer>["db"];

export interface SettingsRouteTestContext {
    app: FastifyInstance;
    db: TestDb;
    token: string;
}

export async function setupSettingsRouteTest(): Promise<SettingsRouteTestContext> {
    const result = createTestApiContainer();
    const db = result.db;
    const container = result.container;

    const app = Fastify();
    app.addHook("onRequest", createAuthHook(container));
    await app.register(settingsRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db });

    return { app, db, token };
}

export async function teardownSettingsRouteTest(context: SettingsRouteTestContext): Promise<void> {
    await context.app.close();
    await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
}
