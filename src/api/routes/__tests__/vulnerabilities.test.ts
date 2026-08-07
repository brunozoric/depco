import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { CommandRunner } from "#api/services/CommandRunner/index.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import type {
    IVulnerability,
    IVulnerabilityDetail,
    IVulnerabilityScanResult,
    IVulnerabilitySummary,
    IEnrichedVulnerability,
    IEnrichAndSortOptions
} from "#api/services/Vulnerability/index.js";
import { OsvCacheService } from "#api/services/Vulnerability/index.js";
import type { IOsvEnrichedDetail } from "#api/services/Vulnerability/index.js";
import { VulnerabilityService as VulnerabilityServiceImpl } from "#api/services/Vulnerability/VulnerabilityService.js";
import { PackageManagerService as PackageManagerServiceImpl } from "#api/services/PackageManagerService.js";
import { AuditParserService as AuditParserServiceImpl } from "#api/services/Vulnerability/AuditParserService.js";
import { OsvCacheService as OsvCacheServiceImpl } from "#api/services/Vulnerability/OsvCacheService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryImpl } from "#api/services/packageManagers/PackageManagerDriverRegistry.js";
import { projects, vulnerabilities, teams, teamProjects } from "#api/db/schema.js";
import { vulnerabilityRoutes } from "../vulnerabilities.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

interface IRouteTestContext {
    app: FastifyInstance;
    db: TestDb;
    token: string;
}

function makeVulnerability(overrides: Partial<IVulnerability> = {}): IVulnerability {
    return {
        id: generateId(),
        projectId: "proj-1",
        packageName: "lodash",
        severity: "high",
        title: "Prototype pollution",
        advisoryUrl: null,
        cveId: null,
        dedupKey: "dedup-1",
        vulnerableRange: "<4.17.21",
        fixVersion: "4.17.21",
        source: "audit",
        dependencyKind: "dependency",
        installedVersion: null,
        scannedAt: Date.now(),
        dismissedAt: null,
        dismissedUntil: null,
        dismissedBy: null,
        ...overrides
    };
}

/**
 * Builds the enriched shape enrichAndSort would normally produce for a raw
 * IVulnerability. Used by the mocked VulnerabilityService's default
 * enrichAndSort implementation and by tests that need to assert on specific
 * enrichment fields (projectName, dependencyKind) without exercising the real
 * service's db-backed enrichment logic (covered separately in
 * VulnerabilityService.test.ts).
 */
function makeEnrichedVulnerability(input: {
    item: IVulnerability;
    projectName: string;
    dependencyKind?: string;
}): IEnrichedVulnerability {
    const { item, projectName, dependencyKind = item.dependencyKind } = input;
    return {
        id: item.id,
        projectId: item.projectId,
        projectName,
        packageName: item.packageName,
        severity: item.severity,
        title: item.title,
        advisoryUrl: item.advisoryUrl,
        cveId: item.cveId,
        vulnerableRange: item.vulnerableRange,
        fixVersion: item.fixVersion,
        source: item.source,
        installedVersion: item.installedVersion,
        dependencyKind,
        scannedAt: item.scannedAt,
        dismissedAt: item.dismissedAt,
        dismissedUntil: item.dismissedUntil,
        dismissedBy: item.dismissedBy
    };
}

function createMockVulnerabilityService(): VulnerabilityService.Interface {
    return {
        scan: vi.fn(),
        getLatest: vi.fn(),
        getAll: vi.fn(),
        getById: vi.fn(),
        getSummary: vi.fn(),
        forceOsvRefresh: vi.fn(),
        bulkDismiss: vi.fn(),
        bulkSnooze: vi.fn(),
        bulkUndismiss: vi.fn(),
        getProjectIdsForVulnerabilityIds: vi.fn(),
        getRecentlyExpiredSnoozes: vi.fn(),
        // Default: enriches with a placeholder projectName/dependencyKind and
        // applies pagination when page+pageSize are given. Tests that assert
        // on specific enrichment content override this per-test.
        enrichAndSort: vi.fn(
            async (input: { items: IVulnerability[]; options?: IEnrichAndSortOptions }) => {
                const { items, options = {} } = input;
                const enriched = items.map(item =>
                    makeEnrichedVulnerability({ item, projectName: "Unknown" })
                );
                const total = enriched.length;
                if (options.page !== undefined && options.pageSize !== undefined) {
                    const start = (options.page - 1) * options.pageSize;
                    return { items: enriched.slice(start, start + options.pageSize), total };
                }
                return { items: enriched, total };
            }
        )
    };
}

function createMockOsvCacheService(): OsvCacheService.Interface {
    return {
        queryBatch: vi.fn(),
        invalidate: vi.fn(),
        getEnrichedDetail: vi.fn(async () => null)
    };
}

function makeVulnerabilityDetail(
    overrides: Partial<IVulnerabilityDetail> = {}
): IVulnerabilityDetail {
    return {
        ...makeVulnerability(),
        projectName: "my-app",
        ...overrides
    };
}

function makeOsvEnrichedDetail(overrides: Partial<IOsvEnrichedDetail> = {}): IOsvEnrichedDetail {
    return {
        description: "Prototype pollution vulnerability",
        references: [{ type: "ADVISORY", url: "https://example.com/advisory" }],
        affectedVersions: [{ introduced: "0", fixed: "4.17.21", lastAffected: null }],
        cvssScore: 7.5,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
        aliases: ["CVE-2021-0001"],
        ...overrides
    };
}

/**
 * Wires the vulnerability routes with real services (VulnerabilityService,
 * PackageManagerService, OsvCacheService, AuditParserService,
 * PackageManagerDriverRegistry) against an in-memory SQLite DB, mocking only
 * CommandRunner — used by the bulk dismiss/rescan/export route tests below,
 * which exercise real filtering/dismiss logic rather than a mocked service.
 */
async function createTestContext(): Promise<IRouteTestContext> {
    const db = await createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(CommandRunner, {
        run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
        runStreaming: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
    });
    container.register(PackageManagerDriverRegistryImpl).inSingletonScope();
    container.register(AuditParserServiceImpl).inSingletonScope();
    container.register(PackageManagerServiceImpl).inSingletonScope();
    container.register(OsvCacheServiceImpl).inSingletonScope();
    container.register(VulnerabilityServiceImpl).inSingletonScope();
    container.registerInstance(EmailService, { send: vi.fn() });
    container.register(UserServiceRegistration).inSingletonScope();
    container.register(AuthServiceRegistration).inSingletonScope();

    const app = Fastify();
    app.addHook("onRequest", createAuthHook(container));
    await app.register(vulnerabilityRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db });

    return { app, db, token };
}

async function insertTestProject(db: TestDb, id: string): Promise<void> {
    const existing = await db.select().from(projects).where(eq(projects.id, id)).all();
    if (existing.length > 0) {
        return;
    }
    await db
        .insert(projects)
        .values({
            id,
            name: id,
            path: `/tmp/${id}`,
            packageManager: "yarn",
            addedAt: Date.now()
        })
        .run();
}

async function seedVulnerabilities(
    db: TestDb,
    count: number,
    projectId = "project-1"
): Promise<string[]> {
    await insertTestProject(db, projectId);

    const ids = Array.from({ length: count }, () => generateId());
    await db.insert(vulnerabilities).values(
        ids.map((id, index) => ({
            id,
            projectId,
            packageName: `pkg-${index}`,
            severity: "high",
            title: `Issue ${index}`,
            advisoryUrl: null,
            cveId: `CVE-${id}`,
            dedupKey: `CVE-${id}`,
            vulnerableRange: null,
            fixVersion: null,
            source: "audit",
            scannedAt: Date.now()
        }))
    );
    return ids;
}

async function seedVulnerabilitiesAcrossProjects(
    db: TestDb,
    countByProjectId: Record<string, number>
): Promise<string[]> {
    const ids: string[] = [];
    for (const [projectId, count] of Object.entries(countByProjectId)) {
        ids.push(...(await seedVulnerabilities(db, count, projectId)));
    }
    return ids;
}

async function seedVulnerabilitiesWithSeverities(
    db: TestDb,
    countBySeverity: Record<string, number>
): Promise<string[]> {
    const projectId = "project-1";
    await insertTestProject(db, projectId);

    const ids: string[] = [];
    for (const [severity, count] of Object.entries(countBySeverity)) {
        for (let index = 0; index < count; index++) {
            const id = generateId();
            ids.push(id);
            await db.insert(vulnerabilities).values({
                id,
                projectId,
                packageName: `pkg-${severity}-${index}`,
                severity,
                title: `Issue ${severity} ${index}`,
                advisoryUrl: null,
                cveId: `CVE-${id}`,
                dedupKey: `CVE-${id}`,
                vulnerableRange: null,
                fixVersion: null,
                source: "audit",
                scannedAt: Date.now()
            });
        }
    }
    return ids;
}

describe("vulnerability routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let vulnerabilityService: VulnerabilityService.Interface;
    let osvCacheService: OsvCacheService.Interface;
    let token: string;

    beforeEach(async () => {
        db = await createTestDb();
        vulnerabilityService = createMockVulnerabilityService();
        osvCacheService = createMockOsvCacheService();
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(VulnerabilityService, vulnerabilityService);
        container.registerInstance(OsvCacheService, osvCacheService);
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(vulnerabilityRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    describe("GET /api/vulnerabilities", () => {
        it("lists all vulnerabilities across projects, enriched with projectName", async () => {
            const items = [makeVulnerability(), makeVulnerability({ id: generateId() })];
            vi.mocked(vulnerabilityService.getAll).mockResolvedValue(items);
            vi.mocked(vulnerabilityService.enrichAndSort).mockResolvedValue({
                items: items.map(item =>
                    makeEnrichedVulnerability({ item, projectName: "my-app" })
                ),
                total: items.length
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(2);
            expect(body.items[0].projectName).toBe("my-app");
            expect(body.items[1].projectName).toBe("my-app");
            expect(vulnerabilityService.getAll).toHaveBeenCalledWith({});
        });

        it("falls back to 'Unknown' when the project no longer exists", async () => {
            const items = [makeVulnerability({ projectId: "missing-project" })];
            vi.mocked(vulnerabilityService.getAll).mockResolvedValue(items);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items[0].projectName).toBe("Unknown");
        });

        it("passes severity/packageName/source filters through to getAll", async () => {
            vi.mocked(vulnerabilityService.getAll).mockResolvedValue([]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities?severity=critical&packageName=lodash&source=osv"
            });

            expect(response.statusCode).toBe(200);
            expect(vulnerabilityService.getAll).toHaveBeenCalledWith({
                severity: "critical",
                packageName: "lodash",
                source: "osv"
            });
        });

        it("resolves teamId to projectIds and passes them through to getAll", async () => {
            await insertTestProject(db, "proj-a");
            await insertTestProject(db, "proj-b");
            await insertTestProject(db, "proj-c");
            const teamId = generateId();
            await db
                .insert(teams)
                .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
                .run();
            await db
                .insert(teamProjects)
                .values([
                    { id: generateId(), teamId, projectId: "proj-a" },
                    { id: generateId(), teamId, projectId: "proj-b" }
                ])
                .run();
            vi.mocked(vulnerabilityService.getAll).mockResolvedValue([]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}`
            });

            expect(response.statusCode).toBe(200);
            expect(vulnerabilityService.getAll).toHaveBeenCalledWith({
                projectIds: expect.arrayContaining(["proj-a", "proj-b"])
            });
            const call = vi.mocked(vulnerabilityService.getAll).mock.calls[0]?.[0];
            expect(call?.projectIds).toHaveLength(2);
        });

        it("intersects teamId-resolved projectIds with an explicit projectIds filter", async () => {
            await insertTestProject(db, "proj-a");
            await insertTestProject(db, "proj-b");
            await insertTestProject(db, "proj-c");
            const teamId = generateId();
            await db
                .insert(teams)
                .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
                .run();
            await db
                .insert(teamProjects)
                .values([
                    { id: generateId(), teamId, projectId: "proj-a" },
                    { id: generateId(), teamId, projectId: "proj-b" }
                ])
                .run();
            vi.mocked(vulnerabilityService.getAll).mockResolvedValue([]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}&projectIds=proj-b,proj-c`
            });

            expect(response.statusCode).toBe(200);
            expect(vulnerabilityService.getAll).toHaveBeenCalledWith({
                projectIds: ["proj-b"]
            });
        });

        it("returns an empty list without calling getAll when teamId has no projects", async () => {
            const teamId = generateId();
            await db
                .insert(teams)
                .values({ id: teamId, name: "Empty Team", color: "#ff0000", createdAt: Date.now() })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
            expect(vulnerabilityService.getAll).not.toHaveBeenCalled();
        });

        it("returns an empty list without calling getAll when teamId/projectIds intersection is empty", async () => {
            await insertTestProject(db, "proj-a");
            await insertTestProject(db, "proj-b");
            const teamId = generateId();
            await db
                .insert(teams)
                .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
                .run();
            await db
                .insert(teamProjects)
                .values({ id: generateId(), teamId, projectId: "proj-a" })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}&projectIds=proj-b`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
            expect(vulnerabilityService.getAll).not.toHaveBeenCalled();
        });
    });

    describe("GET /api/vulnerabilities/summary", () => {
        it("returns counts and project summaries", async () => {
            const summary: IVulnerabilitySummary = {
                totalVulnerabilities: 3,
                counts: { critical: 1, high: 1, moderate: 1, low: 0, info: 0 },
                transitiveCount: 1,
                directCount: 2,
                projectSummaries: [
                    {
                        projectId: "proj-1",
                        projectName: "app",
                        total: 3,
                        critical: 1,
                        high: 1,
                        moderate: 1,
                        low: 0
                    }
                ]
            };
            vi.mocked(vulnerabilityService.getSummary).mockResolvedValue(summary);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.totalVulnerabilities).toBe(3);
            expect(body.counts.critical).toBe(1);
            expect(body.projectSummaries).toHaveLength(1);
            expect(vulnerabilityService.getSummary).toHaveBeenCalled();
        });

        it("includes transitiveCount and directCount fields in the response", async () => {
            const summary: IVulnerabilitySummary = {
                totalVulnerabilities: 5,
                counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
                transitiveCount: 2,
                directCount: 3,
                projectSummaries: []
            };
            vi.mocked(vulnerabilityService.getSummary).mockResolvedValue(summary);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.transitiveCount).toBe(2);
            expect(body.directCount).toBe(3);
        });

        it("returns transitiveCount and directCount that match mixed dependencyKind vulnerabilities", async () => {
            const summary: IVulnerabilitySummary = {
                totalVulnerabilities: 4,
                counts: { critical: 1, high: 1, moderate: 1, low: 1, info: 0 },
                transitiveCount: 3,
                directCount: 1,
                projectSummaries: [
                    {
                        projectId: "proj-1",
                        projectName: "app",
                        total: 4,
                        critical: 1,
                        high: 1,
                        moderate: 1,
                        low: 1
                    }
                ]
            };
            vi.mocked(vulnerabilityService.getSummary).mockResolvedValue(summary);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.transitiveCount).toBe(3);
            expect(body.directCount).toBe(1);
            expect(body.transitiveCount + body.directCount).toBe(body.totalVulnerabilities);
        });
    });

    describe("GET /api/vulnerabilities/:projectId", () => {
        it("lists vulnerabilities for a specific project, enriched with projectName", async () => {
            const items = [makeVulnerability({ projectId: "proj-1" })];
            vi.mocked(vulnerabilityService.getLatest).mockResolvedValue(items);
            vi.mocked(vulnerabilityService.enrichAndSort).mockResolvedValue({
                items: items.map(item =>
                    makeEnrichedVulnerability({ item, projectName: "my-app" })
                ),
                total: items.length
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/proj-1"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(1);
            expect(body.total).toBe(1);
            expect(body.items[0].projectName).toBe("my-app");
            expect(vulnerabilityService.getLatest).toHaveBeenCalledWith("proj-1", {});
        });

        it("applies filters when listing project vulnerabilities", async () => {
            vi.mocked(vulnerabilityService.getLatest).mockResolvedValue([]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/proj-1?severity=low&source=both"
            });

            expect(response.statusCode).toBe(200);
            expect(vulnerabilityService.getLatest).toHaveBeenCalledWith("proj-1", {
                severity: "low",
                source: "both"
            });
        });
    });

    describe("GET /api/vulnerabilities/:projectId (sorting and pagination)", () => {
        it("returns paginated results when page and pageSize are provided", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilities(db, 5, "proj-page");

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/proj-page?page=1&pageSize=2"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(5);

            await testApp.close();
        });

        it("sorts by packageName ascending", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const projectId = "proj-sort";
            await insertTestProject(db, projectId);
            await db.insert(vulnerabilities).values([
                {
                    id: "v-z",
                    projectId,
                    packageName: "zlib",
                    severity: "low",
                    title: "Issue Z",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "z-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                },
                {
                    id: "v-a",
                    projectId,
                    packageName: "axios",
                    severity: "high",
                    title: "Issue A",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "a-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                }
            ]);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: `/api/vulnerabilities/${projectId}?sortBy=packageName&sortOrder=asc`
            });

            const body = JSON.parse(response.body);
            expect(body.items[0].packageName).toBe("axios");
            expect(body.items[1].packageName).toBe("zlib");

            await testApp.close();
        });

        it("defaults to severity desc when no sort params provided", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const projectId = "proj-default-sort";
            await insertTestProject(db, projectId);
            await db.insert(vulnerabilities).values([
                {
                    id: "v-low",
                    projectId,
                    packageName: "low-pkg",
                    severity: "low",
                    title: "Low issue",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "low-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                },
                {
                    id: "v-crit",
                    projectId,
                    packageName: "crit-pkg",
                    severity: "critical",
                    title: "Critical issue",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "crit-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                }
            ]);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: `/api/vulnerabilities/${projectId}`
            });

            const body = JSON.parse(response.body);
            expect(body.items[0].severity).toBe("critical");
            expect(body.items[1].severity).toBe("low");

            await testApp.close();
        });
    });

    describe("POST /api/vulnerabilities/:projectId/scan", () => {
        it("triggers a manual scan for the project", async () => {
            const projectId = generateId();
            await db
                .insert(projects)
                .values({
                    id: projectId,
                    name: "test",
                    path: "/repo/test",
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            const scanResult: IVulnerabilityScanResult = {
                vulnerabilities: [makeVulnerability({ projectId })],
                counts: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 },
                total: 1
            };
            vi.mocked(vulnerabilityService.scan).mockResolvedValue(scanResult);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: `/api/vulnerabilities/${projectId}/scan`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.total).toBe(1);
            expect(body.counts.high).toBe(1);
            expect(vulnerabilityService.scan).toHaveBeenCalledWith({
                projectId,
                projectPath: "/repo/test",
                packageManager: "yarn"
            });
        });

        it("returns 404 when the project does not exist", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/vulnerabilities/does-not-exist/scan"
            });

            expect(response.statusCode).toBe(404);
            expect(vulnerabilityService.scan).not.toHaveBeenCalled();
        });

        it("returns 422 when the project has no detected package manager", async () => {
            const projectId = generateId();
            await db
                .insert(projects)
                .values({
                    id: projectId,
                    name: "test",
                    path: "/repo/test",
                    addedAt: Date.now()
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: `/api/vulnerabilities/${projectId}/scan`
            });

            expect(response.statusCode).toBe(422);
            expect(vulnerabilityService.scan).not.toHaveBeenCalled();
        });
    });

    describe("POST /api/vulnerabilities/osv/refresh", () => {
        it("delegates to forceOsvRefresh with the given options", async () => {
            vi.mocked(vulnerabilityService.forceOsvRefresh).mockResolvedValue(5);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/vulnerabilities/osv/refresh",
                payload: { packageName: "lodash" }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.invalidated).toBe(5);
            expect(vulnerabilityService.forceOsvRefresh).toHaveBeenCalledWith({
                packageName: "lodash"
            });
        });

        it("supports the 'all' flag with no other filters", async () => {
            vi.mocked(vulnerabilityService.forceOsvRefresh).mockResolvedValue(42);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/vulnerabilities/osv/refresh",
                payload: { all: true }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().invalidated).toBe(42);
            expect(vulnerabilityService.forceOsvRefresh).toHaveBeenCalledWith({ all: true });
        });
    });

    describe("PATCH /api/vulnerabilities/bulk", () => {
        it("dismisses selected vulnerabilities", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 3);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [vulnerabilityIds[0], vulnerabilityIds[1]], action: "dismiss" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().updatedCount).toBe(2);

            await testApp.close();
        });

        it("snoozes with required snoozeDays", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 2);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [vulnerabilityIds[0]], action: "snooze", snoozeDays: 30 }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().updatedCount).toBe(1);

            await testApp.close();
        });

        it("rejects snooze without snoozeDays", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 1);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [vulnerabilityIds[0]], action: "snooze" }
            });

            expect(response.statusCode).toBe(400);

            await testApp.close();
        });

        it("rejects empty ids array", async () => {
            const { app: testApp, token: testToken } = await createTestContext();

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: [], action: "dismiss" }
            });

            expect(response.statusCode).toBe(400);

            await testApp.close();
        });

        it("undismisses selected vulnerabilities", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 2);
            await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: vulnerabilityIds, action: "dismiss" }
            });

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "PATCH",
                url: "/api/vulnerabilities/bulk",
                payload: { ids: vulnerabilityIds, action: "undismiss" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().updatedCount).toBe(2);

            await testApp.close();
        });
    });

    describe("POST /api/vulnerabilities/bulk/rescan", () => {
        it("queues scans for unique projects of selected vulnerabilities", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilitiesAcrossProjects(db, {
                "project-1": 2,
                "project-2": 1
            });

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "POST",
                url: "/api/vulnerabilities/bulk/rescan",
                payload: { ids: vulnerabilityIds }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().projectsQueued).toBe(2);

            await testApp.close();
        });

        it("rejects an empty ids array", async () => {
            const { app: testApp, token: testToken } = await createTestContext();

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "POST",
                url: "/api/vulnerabilities/bulk/rescan",
                payload: { ids: [] }
            });

            expect(response.statusCode).toBe(400);

            await testApp.close();
        });
    });

    describe("GET /api/vulnerabilities/export", () => {
        it("exports as JSON with correct content-disposition", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilities(db, 3);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=json"
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers["content-disposition"]).toContain("attachment");
            expect(response.headers["content-type"]).toContain("application/json");
            const data = response.json();
            expect(data).toHaveLength(3);

            await testApp.close();
        });

        it("exports as CSV with header row and quoted fields", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilities(db, 2);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=csv"
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers["content-disposition"]).toContain("attachment");
            expect(response.headers["content-type"]).toContain("text/csv");
            const lines = response.body.split("\n").filter(Boolean);
            expect(lines[0]).toContain("packageName");
            expect(lines[0]).toContain("dependencyKind");
            expect(lines).toHaveLength(3); // header + 2 rows

            await testApp.close();
        });

        it("exports only selected ids when ids param provided", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const vulnerabilityIds = await seedVulnerabilities(db, 5);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: `/api/vulnerabilities/export?format=json&ids=${vulnerabilityIds[0]},${vulnerabilityIds[1]}`
            });

            expect(response.json()).toHaveLength(2);

            await testApp.close();
        });

        it("applies filters to export", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilitiesWithSeverities(db, { critical: 2, low: 3 });

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/export?format=json&severity=critical"
            });

            expect(response.json()).toHaveLength(2);

            await testApp.close();
        });
    });

    describe("GET /api/vulnerabilities/:vulnerabilityId/detail", () => {
        it("returns the vulnerability with a null osvDetail when there is no cveId", async () => {
            const detail = makeVulnerabilityDetail({ cveId: null, dependencyKind: "transitive" });
            vi.mocked(vulnerabilityService.getById).mockResolvedValue(detail);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/some-id/detail"
            });

            expect(response.statusCode).toBe(200);
            expect(vulnerabilityService.getById).toHaveBeenCalledWith("some-id");
            expect(osvCacheService.getEnrichedDetail).not.toHaveBeenCalled();
            const body = response.json();
            expect(body).toMatchObject({ vulnerability: detail, osvDetail: null });
            expect(body.vulnerability.dependencyKind).toBe("transitive");
        });

        it("enriches the vulnerability with OSV detail when a cveId is present", async () => {
            const detail = makeVulnerabilityDetail({
                cveId: "CVE-2021-0001",
                dependencyKind: "transitive"
            });
            const enriched = makeOsvEnrichedDetail();
            vi.mocked(vulnerabilityService.getById).mockResolvedValue(detail);
            vi.mocked(osvCacheService.getEnrichedDetail).mockResolvedValue(enriched);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/some-id/detail"
            });

            expect(response.statusCode).toBe(200);
            expect(osvCacheService.getEnrichedDetail).toHaveBeenCalledWith("CVE-2021-0001");
            const body = response.json();
            expect(body).toMatchObject({ vulnerability: detail, osvDetail: enriched });
            expect(body.vulnerability.dependencyKind).toBe("transitive");
        });

        it("returns 404 when the vulnerability does not exist", async () => {
            vi.mocked(vulnerabilityService.getById).mockResolvedValue(null);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/missing-id/detail"
            });

            expect(response.statusCode).toBe(404);
            expect(response.json()).toEqual({ error: "Vulnerability not found" });
        });

        it("is not shadowed by the /:projectId route", async () => {
            const detail = makeVulnerabilityDetail({ cveId: null });
            vi.mocked(vulnerabilityService.getById).mockResolvedValue(detail);
            vi.mocked(vulnerabilityService.getLatest).mockResolvedValue([]);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/vulnerabilities/some-id/detail"
            });

            expect(response.statusCode).toBe(200);
            expect(vulnerabilityService.getLatest).not.toHaveBeenCalled();
            expect(response.json()).toMatchObject({ vulnerability: { id: detail.id } });
        });
    });

    describe("dependencyType filtering", () => {
        it("list route returns only direct dependencies when dependencyType=direct", async () => {
            const { app, db, token } = await createTestContext();
            try {
                await insertTestProject(db, "proj-1");

                await db.insert(vulnerabilities).values([
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "lodash",
                        dedupKey: "d1",
                        dependencyKind: "dependency"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "transitive-pkg",
                        dedupKey: "d2",
                        dependencyKind: "transitive"
                    })
                ]);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/vulnerabilities?dependencyType=direct"
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body.items).toHaveLength(1);
                expect(body.items[0].packageName).toBe("lodash");
                expect(body.items[0].dependencyKind).toBe("dependency");
            } finally {
                await app.close();
            }
        });

        it("list route returns only transitive dependencies when dependencyType=transitive", async () => {
            const { app, db, token } = await createTestContext();
            try {
                await insertTestProject(db, "proj-1");

                await db.insert(vulnerabilities).values([
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "lodash",
                        dedupKey: "d1",
                        dependencyKind: "dependency"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "transitive-pkg",
                        dedupKey: "d2",
                        dependencyKind: "transitive"
                    })
                ]);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/vulnerabilities?dependencyType=transitive"
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body.items).toHaveLength(1);
                expect(body.items[0].packageName).toBe("transitive-pkg");
                expect(body.items[0].dependencyKind).toBe("transitive");
            } finally {
                await app.close();
            }
        });

        it("list route returns all when no dependencyType specified", async () => {
            const { app, db, token } = await createTestContext();
            try {
                await insertTestProject(db, "proj-1");

                await db.insert(vulnerabilities).values([
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "lodash",
                        dedupKey: "d1",
                        dependencyKind: "dependency"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "transitive-pkg",
                        dedupKey: "d2",
                        dependencyKind: "transitive"
                    })
                ]);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/vulnerabilities"
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body.items).toHaveLength(2);
            } finally {
                await app.close();
            }
        });

        it("export route filters by dependencyType=direct", async () => {
            const { app, db, token } = await createTestContext();
            try {
                await insertTestProject(db, "proj-1");

                await db.insert(vulnerabilities).values([
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "lodash",
                        dedupKey: "d1",
                        dependencyKind: "dependency"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "transitive-pkg",
                        dedupKey: "d2",
                        dependencyKind: "transitive"
                    })
                ]);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/vulnerabilities/export?format=json&dependencyType=direct"
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveLength(1);
                expect(body[0].packageName).toBe("lodash");
            } finally {
                await app.close();
            }
        });

        it("export route filters by dependencyType=transitive", async () => {
            const { app, db, token } = await createTestContext();
            try {
                await insertTestProject(db, "proj-1");

                await db.insert(vulnerabilities).values([
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "lodash",
                        dedupKey: "d1",
                        dependencyKind: "dependency"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "transitive-pkg",
                        dedupKey: "d2",
                        dependencyKind: "transitive"
                    })
                ]);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/vulnerabilities/export?format=json&dependencyType=transitive"
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveLength(1);
                expect(body[0].packageName).toBe("transitive-pkg");
            } finally {
                await app.close();
            }
        });

        it("summary route computes transitiveCount and directCount from stored dependencyKind values", async () => {
            const { app, db, token } = await createTestContext();
            try {
                await insertTestProject(db, "proj-1");

                await db.insert(vulnerabilities).values([
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "lodash",
                        dedupKey: "d1",
                        dependencyKind: "dependency"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "left-pad",
                        dedupKey: "d2",
                        dependencyKind: "devDependency"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "transitive-pkg-1",
                        dedupKey: "d3",
                        dependencyKind: "transitive"
                    }),
                    makeVulnerability({
                        projectId: "proj-1",
                        packageName: "transitive-pkg-2",
                        dedupKey: "d4",
                        dependencyKind: "transitive"
                    })
                ]);

                const response = await app.inject({
                    headers: { authorization: `Bearer ${token}` },
                    method: "GET",
                    url: "/api/vulnerabilities/summary"
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body.totalVulnerabilities).toBe(4);
                expect(body.transitiveCount).toBe(2);
                expect(body.directCount).toBe(2);
            } finally {
                await app.close();
            }
        });
    });
});
