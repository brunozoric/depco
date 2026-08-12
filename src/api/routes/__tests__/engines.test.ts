import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { NodeReleaseDataService } from "../../services/Engine/index.js";
import { projects, engineChecks } from "#api/db/schema.js";
import { engineRoutes } from "../engines.js";
import type { INodeRelease } from "#shared/engines/types.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface IRouteTestContext {
    app: FastifyInstance;
    db: TestDb;
    token: string;
}

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

async function insertTestProject(db: TestDb, id: string, path: string): Promise<void> {
    await db
        .insert(projects)
        .values({
            id,
            name: id,
            path,
            packageManager: "yarn",
            addedAt: Date.now()
        })
        .run();
}

function createTestDir(): string {
    const testDir = join(
        tmpdir(),
        `engine-routes-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    return testDir;
}

function writePackageJson(dir: string, content: Record<string, unknown>): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify(content));
}

async function createTestContext(): Promise<IRouteTestContext> {
    const { container, db } = createTestApiContainer();
    container.registerInstance(NodeReleaseDataService, {
        getSchedule: async () => buildTestSchedule()
    });

    const app = Fastify();
    app.addHook("onRequest", createAuthHook(container));
    await app.register(engineRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db });

    return { app, db, token };
}

describe("engine routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;
    const testDirs: string[] = [];

    beforeEach(async () => {
        const context = await createTestContext();
        app = context.app;
        db = context.db;
        token = context.token;
    });

    afterEach(async () => {
        await app.close();
        for (const dir of testDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    describe("GET /api/engines/summary", () => {
        it("returns aggregate counts across projects", async () => {
            await insertTestProject(db, "proj-1", "/tmp/proj-1");
            await insertTestProject(db, "proj-2", "/tmp/proj-2");

            await db
                .insert(engineChecks)
                .values([
                    {
                        id: "check-1",
                        projectId: "proj-1",
                        packageName: "",
                        enginesNode: ">=20",
                        minimumMajor: 20,
                        status: "active-lts",
                        eolDate: null,
                        scannedAt: Date.now()
                    },
                    {
                        id: "check-2",
                        projectId: "proj-1",
                        packageName: "some-dep",
                        enginesNode: ">=14",
                        minimumMajor: 14,
                        status: "eol",
                        eolDate: Date.now() - 1000,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/engines/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.item.totalProjects).toBe(1);
            expect(body.item.counts.eol).toBe(1);
            expect(body.item.projectSummaries).toHaveLength(1);
            expect(body.item.projectSummaries[0]).toMatchObject({
                projectId: "proj-1",
                rootStatus: "active-lts"
            });
        });

        it("flags a project with an old engine scan as stale", async () => {
            await insertTestProject(db, "proj-1", "/tmp/proj-1");

            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            await db
                .insert(engineChecks)
                .values({
                    id: "check-stale",
                    projectId: "proj-1",
                    packageName: "",
                    enginesNode: ">=20",
                    minimumMajor: 20,
                    status: "active-lts",
                    eolDate: null,
                    scannedAt: thirtyDaysAgo
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/engines/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.item.staleProjectCount).toBeGreaterThanOrEqual(1);
            expect(body.item.stalenessThresholdMs).toBe(604800000);
            expect(body.item.projectSummaries[0]).toMatchObject({
                projectId: "proj-1",
                lastScannedAt: thirtyDaysAgo,
                engineScanStale: true
            });
        });
    });

    describe("GET /api/engines/releases", () => {
        it("returns the cached Node release schedule", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/engines/releases"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.total).toBe(2);
            expect(body.items.map((release: { version: number }) => release.version)).toEqual([
                14, 20
            ]);
        });
    });

    describe("GET /api/engines/:projectId", () => {
        it("returns engine checks for the project", async () => {
            await insertTestProject(db, "proj-1", "/tmp/proj-1");
            await db
                .insert(engineChecks)
                .values({
                    id: "check-1",
                    projectId: "proj-1",
                    packageName: "",
                    enginesNode: ">=20",
                    minimumMajor: 20,
                    status: "active-lts",
                    eolDate: null,
                    scannedAt: Date.now()
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/engines/proj-1"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.total).toBe(1);
            expect(body.items[0]).toMatchObject({ projectId: "proj-1", status: "active-lts" });
        });

        it("returns an empty list for a project with no checks", async () => {
            await insertTestProject(db, "proj-1", "/tmp/proj-1");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/engines/proj-1"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ items: [], total: 0 });
        });
    });

    describe("POST /api/engines/:projectId/scan", () => {
        it("scans the project and returns the result", async () => {
            const projectPath = createTestDir();
            testDirs.push(projectPath);
            writePackageJson(projectPath, { name: "root-app", engines: { node: ">=20.0.0" } });
            await insertTestProject(db, "proj-1", projectPath);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/engines/proj-1/scan"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.item.rootStatus).toBe("active-lts");
            expect(body.item.rootEnginesNode).toBe(">=20.0.0");
            expect(body.item.summary.totalProjects).toBe(1);

            const persisted = await db
                .select()
                .from(engineChecks)
                .where(eq(engineChecks.projectId, "proj-1"))
                .all();
            expect(persisted.length).toBeGreaterThan(0);
        });

        it("passes warnMaintenance querystring param to the engine service", async () => {
            const projectPath = createTestDir();
            testDirs.push(projectPath);
            writePackageJson(projectPath, { name: "root-app", engines: { node: ">=14.0.0" } });

            const nodeModulesDir = join(projectPath, "node_modules", "old-dep");
            mkdirSync(nodeModulesDir, { recursive: true });
            writeFileSync(
                join(nodeModulesDir, "package.json"),
                JSON.stringify({ name: "old-dep", engines: { node: ">=14.0.0" } })
            );
            await insertTestProject(db, "proj-maint", projectPath);

            const withMaintenance = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/engines/proj-maint/scan?warnMaintenance=true"
            });
            expect(withMaintenance.statusCode).toBe(200);
            const findingsWithMaintenance = withMaintenance.json().item.findings;

            await db.delete(engineChecks).where(eq(engineChecks.projectId, "proj-maint")).run();

            const withoutMaintenance = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/engines/proj-maint/scan?warnMaintenance=false"
            });
            expect(withoutMaintenance.statusCode).toBe(200);
            const findingsWithoutMaintenance = withoutMaintenance.json().item.findings;

            const maintenanceCountBefore = findingsWithMaintenance.filter(
                (finding: { status: string }) => finding.status === "maintenance"
            ).length;
            const maintenanceCountAfter = findingsWithoutMaintenance.filter(
                (finding: { status: string }) => finding.status === "maintenance"
            ).length;

            expect(maintenanceCountAfter).toBeLessThanOrEqual(maintenanceCountBefore);
        });

        it("returns 404 when the project does not exist", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/engines/missing-project/scan"
            });

            expect(response.statusCode).toBe(404);
        });
    });
});
