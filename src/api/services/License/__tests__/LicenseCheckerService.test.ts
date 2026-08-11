import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Container } from "@webiny/di";
import type { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { RegistryCacheService as RegistryCacheServiceAbstraction } from "#api/services/RegistryCache/index.js";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { LicenseCheckerService } from "#api/services/License/index.js";
import { scanResults, projects } from "#api/db/schema.js";
import { generateId } from "@webiny/stdlib";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

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

describe("LicenseCheckerService", () => {
    let db: TestDb;
    let container: Container;
    let registryCache: RegistryCacheService.Interface;
    const projectId = "proj-1";

    beforeEach(async () => {
        const result = createTestApiContainer();
        container = result.container;
        db = result.db;
        registryCache = createMockRegistryCacheService();
        container.registerInstance(RegistryCacheServiceAbstraction, registryCache);
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

        const service = container.resolve(LicenseCheckerService);
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

        const service = container.resolve(LicenseCheckerService);
        const results = await service.scan({ projectId, packageManager: "npm" });

        expect(results[0]!.licenseName).toBe("UNKNOWN");
        expect(results[0]!.spdxId).toBeNull();
    });

    it("returns UNKNOWN when registry lookup fails", async () => {
        await seedScanResult(db, projectId, "private-pkg");

        vi.mocked(registryCache.getPackageInfo).mockRejectedValue(new Error("404 not found"));

        const service = container.resolve(LicenseCheckerService);
        const results = await service.scan({ projectId, packageManager: "npm" });

        expect(results[0]!.licenseName).toBe("UNKNOWN");
        expect(results[0]!.spdxId).toBeNull();
    });

    it("returns empty array when no scan results exist", async () => {
        const service = container.resolve(LicenseCheckerService);
        const results = await service.scan({ projectId, packageManager: "npm" });

        expect(results).toEqual([]);
    });
});
