import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { scanResults, projects } from "#api/db/schema.js";
import { generateId } from "@webiny/stdlib";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

function createMockRegistryCacheService(): RegistryCacheService.Interface {
    return {
        getPackageInfo: vi.fn(),
        clearAll: vi.fn(),
        clearPackage: vi.fn()
    };
}

async function seedProject(db: TestDb, projectId: string): Promise<void> {
    await db
        .insert(projects)
        .values({
            id: projectId,
            name: "test-project",
            path: "/test/path",
            addedAt: Date.now()
        })
        .run();
}

async function seedScanResult(db: TestDb, projectId: string, packageName: string): Promise<void> {
    await db
        .insert(scanResults)
        .values({
            id: generateId(),
            projectId,
            name: packageName,
            currentVersion: "1.0.0",
            latestVersion: "2.0.0",
            latestInRange: "1.0.0",
            type: "dependency",
            upgradeType: "major",
            scannedAt: Date.now()
        })
        .run();
}

async function createService(registryCache: RegistryCacheService.Interface, db: TestDb) {
    const { LicenseCheckerService } = await import("#api/services/LicenseCheckerService.js");
    const container = (await import("#shared/index.js")).createContainer();
    container.registerInstance(
        (await import("#api/services/RegistryCache/index.js")).RegistryCacheService,
        registryCache
    );
    container.registerInstance(DatabaseClient, { db });
    container.register(LicenseCheckerService).inSingletonScope();
    const abstraction = (await import("#api/services/abstractions/LicenseCheckerService.js"))
        .LicenseCheckerService;
    return container.resolve(abstraction);
}

describe("LicenseCheckerService", () => {
    let db: TestDb;
    let registryCache: RegistryCacheService.Interface;
    const projectId = "proj-1";

    beforeEach(async () => {
        db = await createTestDb();
        registryCache = createMockRegistryCacheService();
        await seedProject(db, projectId);
    });

    it("resolves licenses from registry cache for all scanned packages", async () => {
        await seedScanResult(db, projectId, "lodash");
        await seedScanResult(db, projectId, "react");

        vi.mocked(registryCache.getPackageInfo).mockImplementation(async (name: string) => ({
            name,
            latestVersion: "1.0.0",
            distTags: {},
            versions: [],
            time: {},
            repoUrl: `https://github.com/owner/${name}`,
            repoDirectory: null,
            readme: null,
            license: "MIT"
        }));

        const service = await createService(registryCache, db);
        const results = await service.scan({ projectId, packageManager: "npm" });

        expect(results).toHaveLength(2);
        expect(results.find(r => r.packageName === "lodash")).toEqual({
            packageName: "lodash",
            licenseName: "MIT",
            spdxId: "MIT",
            licenseUrl: "https://github.com/owner/lodash"
        });
    });

    it("returns UNKNOWN when registry has no license field", async () => {
        await seedScanResult(db, projectId, "mystery-pkg");

        vi.mocked(registryCache.getPackageInfo).mockResolvedValue({
            name: "mystery-pkg",
            latestVersion: "1.0.0",
            distTags: {},
            versions: [],
            time: {},
            repoUrl: null,
            repoDirectory: null,
            readme: null,
            license: null
        });

        const service = await createService(registryCache, db);
        const results = await service.scan({ projectId, packageManager: "npm" });

        expect(results[0]!.licenseName).toBe("UNKNOWN");
        expect(results[0]!.spdxId).toBeNull();
    });

    it("returns UNKNOWN when registry lookup fails", async () => {
        await seedScanResult(db, projectId, "private-pkg");

        vi.mocked(registryCache.getPackageInfo).mockRejectedValue(new Error("404 not found"));

        const service = await createService(registryCache, db);
        const results = await service.scan({ projectId, packageManager: "npm" });

        expect(results[0]!.licenseName).toBe("UNKNOWN");
        expect(results[0]!.spdxId).toBeNull();
    });

    it("returns empty array when no scan results exist", async () => {
        const service = await createService(registryCache, db);
        const results = await service.scan({ projectId, packageManager: "npm" });

        expect(results).toEqual([]);
    });
});
