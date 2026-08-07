import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";

async function createService(databaseClient: DatabaseClient.Interface) {
    const { AutoFixSettingsServiceImpl } =
        await import("#api/services/AutoFix/AutoFixSettingsService.js");
    return new AutoFixSettingsServiceImpl(databaseClient);
}

describe("AutoFixSettingsService", () => {
    let databaseClient: DatabaseClient.Interface;
    const projectId = "project-1";

    beforeEach(async () => {
        databaseClient = await createTestDatabaseClient();
        await databaseClient.db
            .insert(projects)
            .values({
                id: projectId,
                name: "Test Project",
                path: "/test",
                addedAt: Date.now()
            })
            .run();
    });

    it("should return null when no settings exist", async () => {
        const service = await createService(databaseClient);
        const result = await service.getSettings(projectId);
        expect(result).toBeNull();
    });

    it("should return defaults when no settings exist", async () => {
        const service = await createService(databaseClient);
        const result = await service.getSettingsOrDefaults(projectId);
        expect(result.enabled).toBe(false);
        expect(result.upgradeTypes).toEqual(["patch"]);
        expect(result.groupingStrategy).toBe("per-package");
        expect(result.branchPrefix).toBe("auto-fix/");
    });

    it("should create settings on first update", async () => {
        const service = await createService(databaseClient);
        const result = await service.updateSettings(projectId, {
            enabled: true,
            upgradeTypes: ["patch", "minor"]
        });
        expect(result.enabled).toBe(true);
        expect(result.upgradeTypes).toEqual(["patch", "minor"]);
        expect(result.groupingStrategy).toBe("per-package");
    });

    it("should update existing settings", async () => {
        const service = await createService(databaseClient);
        await service.updateSettings(projectId, { enabled: true });
        const result = await service.updateSettings(projectId, {
            groupingStrategy: "per-project"
        });
        expect(result.enabled).toBe(true);
        expect(result.groupingStrategy).toBe("per-project");
    });

    it("should return saved settings via getSettings", async () => {
        const service = await createService(databaseClient);
        await service.updateSettings(projectId, {
            enabled: true,
            branchPrefix: "deps/"
        });
        const result = await service.getSettings(projectId);
        expect(result).not.toBeNull();
        expect(result!.enabled).toBe(true);
        expect(result!.branchPrefix).toBe("deps/");
    });
});
