import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import {
    projects,
    scanResults,
    licenses,
    vulnerabilities,
    dependencyEdges
} from "#api/db/schema.js";
import { SbomService as SbomServiceAbstraction } from "../abstractions/SbomService.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

describe("SbomService", () => {
    let db: TestDb;
    let service: SbomServiceAbstraction.Interface;

    beforeEach(() => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        service = container.resolve(SbomServiceAbstraction);
    });

    async function seedProject(id: string, name: string): Promise<void> {
        await db
            .insert(projects)
            .values({
                id,
                name,
                path: `/projects/${name}`,
                addedAt: Date.now(),
                packageManager: "yarn"
            })
            .run();
    }

    async function seedScanResult(
        projectId: string,
        packageName: string,
        version: string,
        type: string
    ): Promise<void> {
        await db
            .insert(scanResults)
            .values({
                id: generateId(),
                projectId,
                name: packageName,
                currentVersion: version,
                latestVersion: version,
                latestInRange: version,
                type,
                upgradeType: "none",
                scannedAt: Date.now()
            })
            .run();
    }

    async function seedLicense(
        projectId: string,
        packageName: string,
        spdxId: string
    ): Promise<void> {
        await db
            .insert(licenses)
            .values({
                id: generateId(),
                projectId,
                packageName,
                licenseName: spdxId,
                spdxId,
                source: "registry",
                riskTier: "permissive",
                scannedAt: Date.now()
            })
            .run();
    }

    async function seedVulnerability(
        projectId: string,
        packageName: string,
        advisoryId: string,
        severity: string
    ): Promise<void> {
        await db
            .insert(vulnerabilities)
            .values({
                id: generateId(),
                projectId,
                packageName,
                severity,
                title: `Advisory ${advisoryId}`,
                advisoryUrl: `https://example.com/${advisoryId}`,
                dedupKey: advisoryId,
                source: "osv",
                scannedAt: Date.now()
            })
            .run();
    }

    async function seedEdge(
        projectId: string,
        parentPackage: string | null,
        parentVersion: string | null,
        childPackage: string,
        childVersion: string,
        depth: number
    ): Promise<void> {
        await db
            .insert(dependencyEdges)
            .values({
                id: generateId(),
                projectId,
                parentPackage,
                parentVersion,
                childPackage,
                childVersion,
                dependencyType: "dependency",
                depth,
                scannedAt: Date.now()
            })
            .run();
    }

    describe("collectForProject", () => {
        it("returns empty arrays for a project with no scan data", async () => {
            await seedProject("p1", "my-app");
            const data = await service.collectForProject("p1");
            expect(data.projectName).toBe("my-app");
            expect(data.projectPath).toBe("/projects/my-app");
            expect(data.packageManager).toBe("yarn");
            expect(data.components).toEqual([]);
            expect(data.vulnerabilities).toEqual([]);
            expect(data.edges).toEqual([]);
        });

        it("collects components from scan results with license info", async () => {
            await seedProject("p1", "my-app");
            await seedScanResult("p1", "lodash", "4.17.21", "dependency");
            await seedLicense("p1", "lodash", "MIT");

            const data = await service.collectForProject("p1");

            expect(data.components).toHaveLength(1);
            expect(data.components[0]).toEqual({
                packageName: "lodash",
                version: "4.17.21",
                spdxId: "MIT",
                licenseName: "MIT",
                type: "dependency"
            });
        });

        it("collects vulnerabilities", async () => {
            await seedProject("p1", "my-app");
            await seedVulnerability("p1", "lodash", "CVE-2021-1234", "high");

            const data = await service.collectForProject("p1");

            expect(data.vulnerabilities).toHaveLength(1);
            expect(data.vulnerabilities[0]!.advisoryId).toBe("CVE-2021-1234");
            expect(data.vulnerabilities[0]!.severity).toBe("high");
            expect(data.vulnerabilities[0]!.packageName).toBe("lodash");
        });

        it("collects dependency edges", async () => {
            await seedProject("p1", "my-app");
            await seedEdge("p1", null, null, "lodash", "4.17.21", 0);
            await seedEdge("p1", "lodash", "4.17.21", "lodash.merge", "4.6.2", 1);

            const data = await service.collectForProject("p1");

            expect(data.edges).toHaveLength(2);
        });

        it("returns components without license info when no license record exists", async () => {
            await seedProject("p1", "my-app");
            await seedScanResult("p1", "lodash", "4.17.21", "dependency");

            const data = await service.collectForProject("p1");

            expect(data.components[0]!.spdxId).toBeNull();
            expect(data.components[0]!.licenseName).toBeNull();
        });
    });

    describe("collectForAllProjects", () => {
        it("merges components from multiple projects deduped by packageName+version", async () => {
            await seedProject("p1", "app-a");
            await seedProject("p2", "app-b");
            await seedScanResult("p1", "lodash", "4.17.21", "dependency");
            await seedScanResult("p2", "lodash", "4.17.21", "dependency");
            await seedScanResult("p2", "axios", "1.6.0", "dependency");

            const data = await service.collectForAllProjects();

            expect(data.projectName).toBe("all-projects");
            expect(data.projectPath).toBe("");
            expect(data.packageManager).toBeNull();
            expect(data.components).toHaveLength(2);
            const names = data.components.map(c => c.packageName).sort();
            expect(names).toEqual(["axios", "lodash"]);
        });

        it("deduplicates vulnerabilities by advisoryId + packageName", async () => {
            await seedProject("p1", "app-a");
            await seedProject("p2", "app-b");
            await seedVulnerability("p1", "lodash", "CVE-2021-1234", "high");
            await seedVulnerability("p2", "lodash", "CVE-2021-1234", "high");

            const data = await service.collectForAllProjects();

            expect(data.vulnerabilities).toHaveLength(1);
        });

        it("deduplicates edges from multiple projects", async () => {
            await seedProject("p1", "app-a");
            await seedProject("p2", "app-b");
            await seedEdge("p1", null, null, "lodash", "4.17.21", 0);
            await seedEdge("p2", null, null, "lodash", "4.17.21", 0);

            const data = await service.collectForAllProjects();

            expect(data.edges).toHaveLength(1);
        });

        it("returns empty when no projects exist", async () => {
            const data = await service.collectForAllProjects();

            expect(data.components).toEqual([]);
            expect(data.vulnerabilities).toEqual([]);
            expect(data.edges).toEqual([]);
        });
    });
});
