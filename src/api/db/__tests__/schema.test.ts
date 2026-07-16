import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import {
    projects,
    upgradeJobs,
    securityChecks,
    scanResults,
    pmSecuritySettings
} from "../schema.js";

describe("database schema", () => {
    let db: LibSQLDatabase;

    beforeEach(async () => {
        db = await createTestDb();
    });

    it("inserts and retrieves a project", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test-project",
                path: "/tmp/test",
                addedAt: Date.now()
            })
            .run();

        const result = await db.select().from(projects).where(eq(projects.id, "p1")).get();
        expect(result).toBeDefined();
        expect(result!.name).toBe("test-project");
        expect(result!.path).toBe("/tmp/test");
    });

    it("inserts and retrieves an upgrade job", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
            .run();

        await db
            .insert(upgradeJobs)
            .values({
                id: "j1",
                referenceId: "p1",
                type: "dependency",
                status: "pending",
                packages: JSON.stringify([{ name: "react", from: "18.0.0", to: "19.0.0" }])
            })
            .run();

        const result = await db.select().from(upgradeJobs).where(eq(upgradeJobs.id, "j1")).get();
        expect(result).toBeDefined();
        expect(result!.status).toBe("pending");
        expect(result!.type).toBe("dependency");
        expect(result!.referenceId).toBe("p1");
        expect(result!.referenceType).toBe("project");
    });

    it("inserts and retrieves a security check", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
            .run();

        await db
            .insert(securityChecks)
            .values({
                id: "sc1",
                projectId: "p1",
                checkedAt: Date.now(),
                results: JSON.stringify({
                    npmPreapprovedPackages: true,
                    approvedGitRepositories: false
                }),
                passes: 0
            })
            .run();

        const result = await db
            .select()
            .from(securityChecks)
            .where(eq(securityChecks.id, "sc1"))
            .get();
        expect(result).toBeDefined();
        expect(result!.passes).toBe(0);
        expect(JSON.parse(result!.results)).toEqual({
            npmPreapprovedPackages: true,
            approvedGitRepositories: false
        });
    });

    it("enforces unique path constraint on projects", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
            .run();

        await expect(
            db
                .insert(projects)
                .values({ id: "p2", name: "test2", path: "/tmp/test", addedAt: Date.now() })
                .run()
        ).rejects.toThrow();
    });

    it("stores packageManager and pmVersion on projects", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: "/tmp/test",
                packageManager: "yarn",
                pmVersion: "4.1.0",
                addedAt: Date.now()
            })
            .run();

        const result = await db.select().from(projects).where(eq(projects.id, "p1")).get();
        expect(result).toBeDefined();
        expect(result!.packageManager).toBe("yarn");
        expect(result!.pmVersion).toBe("4.1.0");
    });

    it("allows packageManager and pmVersion to be null on projects", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
            .run();

        const result = await db.select().from(projects).where(eq(projects.id, "p1")).get();
        expect(result).toBeDefined();
        expect(result!.packageManager).toBeNull();
        expect(result!.pmVersion).toBeNull();
    });

    it("inserts and retrieves a scan result", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
            .run();

        await db
            .insert(scanResults)
            .values({
                id: "sr1",
                projectId: "p1",
                name: "left-pad",
                currentVersion: "1.0.0",
                latestVersion: "2.0.0",
                latestInRange: "1.2.0",
                type: "dependency",
                upgradeType: "minor",
                scannedAt: Date.now()
            })
            .run();

        const result = await db.select().from(scanResults).where(eq(scanResults.id, "sr1")).get();
        expect(result).toBeDefined();
        expect(result!.projectId).toBe("p1");
        expect(result!.name).toBe("left-pad");
        expect(result!.currentVersion).toBe("1.0.0");
        expect(result!.latestVersion).toBe("2.0.0");
        expect(result!.latestInRange).toBe("1.2.0");
        expect(result!.type).toBe("dependency");
        expect(result!.upgradeType).toBe("minor");
    });

    it("deletes scan results when queried by projectId", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "test", path: "/tmp/test", addedAt: Date.now() })
            .run();

        await db
            .insert(scanResults)
            .values({
                id: "sr1",
                projectId: "p1",
                name: "left-pad",
                currentVersion: "1.0.0",
                latestVersion: "2.0.0",
                latestInRange: "1.2.0",
                type: "dependency",
                upgradeType: "minor",
                scannedAt: Date.now()
            })
            .run();

        const before = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "p1"))
            .all();
        expect(before).toHaveLength(1);

        await db.delete(scanResults).where(eq(scanResults.projectId, "p1")).run();

        const after = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "p1"))
            .all();
        expect(after).toHaveLength(0);
    });

    it("inserts and retrieves a pm security setting", async () => {
        await db
            .insert(pmSecuritySettings)
            .values({
                id: "pmss1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            })
            .run();

        const result = await db
            .select()
            .from(pmSecuritySettings)
            .where(eq(pmSecuritySettings.id, "pmss1"))
            .get();
        expect(result).toBeDefined();
        expect(result!.packageManager).toBe("yarn");
        expect(result!.configFile).toBe(".yarnrc.yml");
        expect(result!.fieldName).toBe("enableScripts");
        expect(result!.expectedValue).toBe("false");
    });

    it("enforces uniqueness on packageManager + configFile + fieldName", async () => {
        await db
            .insert(pmSecuritySettings)
            .values({
                id: "pmss1",
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            })
            .run();

        await expect(
            db
                .insert(pmSecuritySettings)
                .values({
                    id: "pmss2",
                    packageManager: "yarn",
                    configFile: ".yarnrc.yml",
                    fieldName: "enableScripts",
                    expectedValue: "false"
                })
                .run()
        ).rejects.toThrow();
    });
});
