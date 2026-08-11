import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, scanResults, dependencyChanges } from "#api/db/schema.js";
import { DependencyChangeService as DependencyChangeServiceAbstraction } from "../abstractions/DependencyChangeService.js";

describe("DependencyChangeService", () => {
    let db: BetterSQLite3Database;
    let service: DependencyChangeServiceAbstraction.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        service = container.resolve(DependencyChangeServiceAbstraction);
    });

    async function seedProject(id: string, name: string): Promise<void> {
        await db
            .insert(projects)
            .values({ id, name, path: `/projects/${name}`, addedAt: Date.now() })
            .run();
    }

    async function seedScanResult(
        projectId: string,
        name: string,
        currentVersion: string
    ): Promise<void> {
        await db
            .insert(scanResults)
            .values({
                id: generateId(),
                projectId,
                name,
                currentVersion,
                latestVersion: currentVersion,
                latestInRange: currentVersion,
                type: "dependency",
                upgradeType: "none",
                scannedAt: Date.now()
            })
            .run();
    }

    interface IChangeRow {
        packageName: string;
        changeType: string;
        previousVersion: string | null;
        newVersion: string | null;
    }

    async function getChanges(): Promise<IChangeRow[]> {
        return db
            .select({
                packageName: dependencyChanges.packageName,
                changeType: dependencyChanges.changeType,
                previousVersion: dependencyChanges.previousVersion,
                newVersion: dependencyChanges.newVersion
            })
            .from(dependencyChanges)
            .all();
    }

    it("detects added packages on first scan (no previous data)", async () => {
        await seedProject("p1", "my-app");

        const count = await service.detectAndPersist("p1", [
            { name: "lodash", currentVersion: "4.17.21" },
            { name: "axios", currentVersion: "1.6.0" }
        ]);

        expect(count).toBe(2);
        const changes = await getChanges();
        expect(changes).toHaveLength(2);
        expect(changes.every(change => change.changeType === "added")).toBe(true);
    });

    it("detects removed packages", async () => {
        await seedProject("p1", "my-app");
        await seedScanResult("p1", "lodash", "4.17.21");
        await seedScanResult("p1", "axios", "1.6.0");

        const count = await service.detectAndPersist("p1", [
            { name: "lodash", currentVersion: "4.17.21" }
        ]);

        expect(count).toBe(1);
        const changes = await getChanges();
        const removed = changes.filter(change => change.changeType === "removed");
        expect(removed).toHaveLength(1);
        expect(removed[0]!.packageName).toBe("axios");
        expect(removed[0]!.previousVersion).toBe("1.6.0");
        expect(removed[0]!.newVersion).toBeNull();
    });

    it("detects version changes", async () => {
        await seedProject("p1", "my-app");
        await seedScanResult("p1", "lodash", "4.17.20");

        const count = await service.detectAndPersist("p1", [
            { name: "lodash", currentVersion: "4.17.21" }
        ]);

        expect(count).toBe(1);
        const changes = await getChanges();
        expect(changes[0]!.changeType).toBe("version-changed");
        expect(changes[0]!.previousVersion).toBe("4.17.20");
        expect(changes[0]!.newVersion).toBe("4.17.21");
    });

    it("returns zero when scan is unchanged", async () => {
        await seedProject("p1", "my-app");
        await seedScanResult("p1", "lodash", "4.17.21");

        const count = await service.detectAndPersist("p1", [
            { name: "lodash", currentVersion: "4.17.21" }
        ]);

        expect(count).toBe(0);
        const changes = await getChanges();
        expect(changes).toHaveLength(0);
    });

    it("handles mixed adds, removes, and version changes", async () => {
        await seedProject("p1", "my-app");
        await seedScanResult("p1", "lodash", "4.17.20");
        await seedScanResult("p1", "axios", "1.5.0");

        const count = await service.detectAndPersist("p1", [
            { name: "lodash", currentVersion: "4.17.21" },
            { name: "express", currentVersion: "4.18.0" }
        ]);

        expect(count).toBe(3);
        const changes = await getChanges();
        const types = changes.map(change => `${change.packageName}:${change.changeType}`).sort();
        expect(types).toEqual(["axios:removed", "express:added", "lodash:version-changed"]);
    });
});
