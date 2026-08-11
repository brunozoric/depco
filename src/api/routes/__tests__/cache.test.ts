import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { registryCache } from "#api/db/schema.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { cacheRoutes } from "../cache.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

describe("cache routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;

    beforeEach(async () => {
        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;

        container.registerInstance(CommandRunner, {
            run: async () => ({
                stdout: JSON.stringify({
                    "dist-tags": { latest: "19.2.7" },
                    versions: ["19.0.0", "19.2.7"]
                }),
                stderr: "",
                exitCode: 0
            }),
            runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
        });

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(cacheRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("DELETE /api/cache clears the entire registry cache", async () => {
        await db
            .insert(registryCache)
            .values({ packageName: "react", data: "{}", cachedAt: Date.now() })
            .run();
        await db
            .insert(registryCache)
            .values({ packageName: "vue", data: "{}", cachedAt: Date.now() })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: "/api/cache"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ success: true });
        expect(await db.select().from(registryCache).all()).toHaveLength(0);
    });

    it("DELETE /api/cache/:packageName clears a single package's cache entry", async () => {
        await db
            .insert(registryCache)
            .values({ packageName: "react", data: "{}", cachedAt: Date.now() })
            .run();
        await db
            .insert(registryCache)
            .values({ packageName: "vue", data: "{}", cachedAt: Date.now() })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: "/api/cache/react"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ success: true });
        expect(
            await db
                .select()
                .from(registryCache)
                .where(eq(registryCache.packageName, "react"))
                .get()
        ).toBeUndefined();
        expect(
            await db.select().from(registryCache).where(eq(registryCache.packageName, "vue")).get()
        ).toBeDefined();
    });
});
