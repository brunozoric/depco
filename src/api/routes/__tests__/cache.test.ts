import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { registryCache } from "#api/db/schema.js";
import { CommandRunner } from "../../services/abstractions/CommandRunner.js";
import { FileConfigService } from "../../services/abstractions/FileConfigService.js";
import { RegistryCacheService as RegistryCacheServiceReg } from "../../services/RegistryCacheService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../services/packageManagers/PackageManagerDriverRegistry.js";
import { cacheRoutes } from "../cache.js";

function createStubFileConfigService(): FileConfigService.Interface {
    return {
        readConfig: async () => null,
        readGlobalSettings: async () => ({ settings: null }),
        readGlobalConfig: async () => ({ config: null }),
        writeGlobalPmSettings: async () => {}
    };
}

describe("cache routes", () => {
    let app: FastifyInstance;
    let db: Awaited<ReturnType<typeof createTestDb>>;

    beforeEach(async () => {
        db = await createTestDb();

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
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
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.registerInstance(FileConfigService, createStubFileConfigService());
        container.register(RegistryCacheServiceReg).inSingletonScope();

        app = Fastify();
        await app.register(cacheRoutes, { container });
        await app.ready();
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

        const response = await app.inject({ method: "DELETE", url: "/api/cache" });

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

        const response = await app.inject({ method: "DELETE", url: "/api/cache/react" });

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
