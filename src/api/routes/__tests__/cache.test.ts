import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { registryCache } from "#api/db/schema.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { FileConfigService } from "../../services/FileConfig/index.js";
import { RegistryCacheService as RegistryCacheServiceReg } from "../../services/RegistryCache/RegistryCacheService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../services/PackageManager/PackageManagerDriverRegistry.js";
import { EmailService } from "../../services/Email/index.js";
import { UserService as UserServiceRegistration } from "../../services/UserService.js";
import { AuthService as AuthServiceRegistration } from "../../services/AuthService.js";
import { createAuthHook } from "../../middleware/authHook.js";
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
    let token: string;

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
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

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
