import { describe, it, expect, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { eq } from "drizzle-orm";
import { Logger } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { engineChecks, projects } from "#api/db/schema.js";
import { EngineService } from "../abstractions/EngineService.js";
import { NodeReleaseDataService } from "../abstractions/NodeReleaseDataService.js";
import type { INodeRelease } from "#shared/engines/types.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function buildTestSchedule(): INodeRelease[] {
    const now = Date.now();
    return [
        {
            version: 14,
            codename: null,
            releaseDate: now - 1_000_000_000,
            ltsStart: now - 900_000_000,
            maintenanceStart: now - 500_000_000,
            eolDate: now - 100_000_000
        },
        {
            version: 20,
            codename: "Test20",
            releaseDate: now - 900_000_000,
            ltsStart: now - 800_000_000,
            maintenanceStart: now + 800_000_000,
            eolDate: now + 900_000_000
        }
    ];
}

function createService(schedule: INodeRelease[] = buildTestSchedule()): {
    service: EngineService.Interface;
    db: TestDb;
} {
    const { container, db } = createTestApiContainer();
    container.registerInstance(NodeReleaseDataService, {
        getSchedule: async () => schedule
    });
    const service = container.resolve(EngineService);
    return { service, db };
}

async function insertProject(db: TestDb, id: string, name: string): Promise<void> {
    await db.insert(projects).values({
        id,
        name,
        path: `/tmp/${id}`,
        packageManager: "yarn",
        addedAt: Date.now()
    });
}

function createTestDir(): string {
    const testDir = join(
        tmpdir(),
        `engine-service-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    return testDir;
}

function writePackageJson(dir: string, content: Record<string, unknown>): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify(content));
}

describe("EngineService", () => {
    describe("scan", () => {
        it("reads root package.json engines, walks node_modules, classifies, and persists findings", async () => {
            const projectPath = createTestDir();
            writePackageJson(projectPath, { name: "root-app", engines: { node: ">=20.0.0" } });
            writePackageJson(join(projectPath, "node_modules", "pkg-eol"), {
                name: "pkg-eol",
                engines: { node: ">=14.0.0" }
            });
            writePackageJson(join(projectPath, "node_modules", "pkg-no-engines"), {
                name: "pkg-no-engines"
            });
            writePackageJson(join(projectPath, "node_modules", "@scope", "pkg-scoped"), {
                name: "@scope/pkg-scoped",
                engines: { node: ">=20.0.0" }
            });
            mkdirSync(join(projectPath, "node_modules", ".bin"), { recursive: true });

            const { service, db } = createService();
            await insertProject(db, "project-1", "Project One");

            const result = await service.scan({ projectId: "project-1", projectPath });

            expect(result.rootStatus).toBe("active-lts");
            expect(result.rootEnginesNode).toBe(">=20.0.0");
            expect(result.findings).toHaveLength(3);

            const byName = new Map(result.findings.map(finding => [finding.packageName, finding]));
            expect(byName.get("pkg-eol")).toMatchObject({
                enginesNode: ">=14.0.0",
                minimumMajor: 14,
                status: "eol"
            });
            expect(byName.get("pkg-no-engines")).toMatchObject({
                enginesNode: null,
                minimumMajor: null,
                status: "unknown"
            });
            expect(byName.get("@scope/pkg-scoped")).toMatchObject({
                enginesNode: ">=20.0.0",
                minimumMajor: 20,
                status: "active-lts"
            });

            const rows = await db
                .select()
                .from(engineChecks)
                .where(eq(engineChecks.projectId, "project-1"))
                .all();
            expect(rows).toHaveLength(4);

            expect(result.summary.totalProjects).toBe(1);
            expect(result.summary.counts).toEqual({
                eol: 1,
                maintenance: 0,
                activeLts: 1,
                current: 0,
                unknown: 1
            });

            rmSync(projectPath, { recursive: true, force: true });
        });

        it("sweeps stale rows after a subsequent scan drops a package", async () => {
            const projectPath = createTestDir();
            writePackageJson(projectPath, { name: "root-app" });
            writePackageJson(join(projectPath, "node_modules", "pkg-a"), { name: "pkg-a" });
            writePackageJson(join(projectPath, "node_modules", "pkg-b"), { name: "pkg-b" });

            const { service, db } = createService();
            await insertProject(db, "project-1", "Project One");

            await service.scan({ projectId: "project-1", projectPath });
            let rows = await db
                .select()
                .from(engineChecks)
                .where(eq(engineChecks.projectId, "project-1"))
                .all();
            expect(rows).toHaveLength(3);

            rmSync(join(projectPath, "node_modules", "pkg-b"), { recursive: true, force: true });

            await service.scan({ projectId: "project-1", projectPath });
            rows = await db
                .select()
                .from(engineChecks)
                .where(eq(engineChecks.projectId, "project-1"))
                .all();
            expect(rows.map(row => row.packageName).sort()).toEqual(["", "pkg-a"]);

            rmSync(projectPath, { recursive: true, force: true });
        });

        it("classifies status as unknown when engines.node is missing", async () => {
            const projectPath = createTestDir();
            writePackageJson(projectPath, { name: "root-app" });

            const { service, db } = createService();
            await insertProject(db, "project-1", "Project One");

            const result = await service.scan({ projectId: "project-1", projectPath });

            expect(result.rootStatus).toBe("unknown");
            expect(result.rootEnginesNode).toBeNull();
            expect(result.findings).toHaveLength(0);

            rmSync(projectPath, { recursive: true, force: true });
        });

        it("handles a malformed node_modules package.json gracefully and logs a warning", async () => {
            const projectPath = createTestDir();
            writePackageJson(projectPath, { name: "root-app" });
            mkdirSync(join(projectPath, "node_modules", "bad-pkg"), { recursive: true });
            writeFileSync(
                join(projectPath, "node_modules", "bad-pkg", "package.json"),
                "{ not valid json"
            );

            const { container, db } = createTestApiContainer();
            container.registerInstance(NodeReleaseDataService, {
                getSchedule: async () => buildTestSchedule()
            });
            const service = container.resolve(EngineService);
            const logger = container.resolve(Logger);
            const warnSpy = vi.spyOn(logger, "warn");

            await insertProject(db, "project-1", "Project One");

            const result = await service.scan({ projectId: "project-1", projectPath });

            expect(result.findings).toHaveLength(1);
            expect(result.findings[0]).toMatchObject({
                packageName: "bad-pkg",
                enginesNode: null,
                minimumMajor: null,
                status: "unknown"
            });
            expect(warnSpy).toHaveBeenCalledWith(
                "Failed to read engines.node for package during engine scan",
                expect.objectContaining({ packageName: "bad-pkg" })
            );

            rmSync(projectPath, { recursive: true, force: true });
        });
    });

    describe("getByProject", () => {
        it("returns persisted engine checks for a project", async () => {
            const projectPath = createTestDir();
            writePackageJson(projectPath, { name: "root-app", engines: { node: ">=20.0.0" } });
            writePackageJson(join(projectPath, "node_modules", "pkg-a"), { name: "pkg-a" });

            const { service, db } = createService();
            await insertProject(db, "project-1", "Project One");
            await service.scan({ projectId: "project-1", projectPath });

            const checks = await service.getByProject("project-1");

            expect(checks).toHaveLength(2);
            expect(checks.map(check => check.packageName).sort()).toEqual(["", "pkg-a"]);

            rmSync(projectPath, { recursive: true, force: true });
        });

        it("returns an empty array for a project with no checks", async () => {
            const { service } = createService();
            const checks = await service.getByProject("nonexistent");
            expect(checks).toEqual([]);
        });
    });

    describe("getSummary", () => {
        it("aggregates root status and dependency counts across projects", async () => {
            const { service, db } = createService();
            await insertProject(db, "project-1", "Project One");
            await insertProject(db, "project-2", "Project Two");

            await db.insert(engineChecks).values([
                {
                    id: "check-1",
                    projectId: "project-1",
                    packageName: "",
                    enginesNode: ">=20.0.0",
                    minimumMajor: 20,
                    status: "active-lts",
                    eolDate: null,
                    scannedAt: Date.now()
                },
                {
                    id: "check-2",
                    projectId: "project-1",
                    packageName: "pkg-a",
                    enginesNode: ">=14.0.0",
                    minimumMajor: 14,
                    status: "eol",
                    eolDate: Date.now() - 1000,
                    scannedAt: Date.now()
                },
                {
                    id: "check-3",
                    projectId: "project-2",
                    packageName: "",
                    enginesNode: null,
                    minimumMajor: null,
                    status: "unknown",
                    eolDate: null,
                    scannedAt: Date.now()
                }
            ]);

            const summary = await service.getSummary();

            expect(summary.totalProjects).toBe(2);
            expect(summary.counts).toEqual({
                eol: 1,
                maintenance: 0,
                activeLts: 0,
                current: 0,
                unknown: 0
            });

            const projectOneSummary = summary.projectSummaries.find(
                project => project.projectId === "project-1"
            );
            expect(projectOneSummary).toMatchObject({
                projectName: "Project One",
                rootStatus: "active-lts",
                rootEnginesNode: ">=20.0.0",
                dependencyCounts: {
                    eol: 1,
                    maintenance: 0,
                    activeLts: 0,
                    current: 0,
                    unknown: 0
                }
            });

            const projectTwoSummary = summary.projectSummaries.find(
                project => project.projectId === "project-2"
            );
            expect(projectTwoSummary).toMatchObject({
                projectName: "Project Two",
                rootStatus: "unknown",
                rootEnginesNode: null,
                dependencyCounts: {
                    eol: 0,
                    maintenance: 0,
                    activeLts: 0,
                    current: 0,
                    unknown: 0
                }
            });
        });

        it("filters by projectIds when provided", async () => {
            const { service, db } = createService();
            await insertProject(db, "project-1", "Project One");
            await insertProject(db, "project-2", "Project Two");

            await db.insert(engineChecks).values([
                {
                    id: "check-1",
                    projectId: "project-1",
                    packageName: "",
                    enginesNode: null,
                    minimumMajor: null,
                    status: "unknown",
                    eolDate: null,
                    scannedAt: Date.now()
                },
                {
                    id: "check-2",
                    projectId: "project-2",
                    packageName: "",
                    enginesNode: null,
                    minimumMajor: null,
                    status: "unknown",
                    eolDate: null,
                    scannedAt: Date.now()
                }
            ]);

            const summary = await service.getSummary({ projectIds: ["project-1"] });

            expect(summary.totalProjects).toBe(1);
            expect(summary.projectSummaries.map(project => project.projectId)).toEqual([
                "project-1"
            ]);
        });
    });
});
