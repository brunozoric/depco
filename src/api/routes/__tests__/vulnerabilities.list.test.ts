import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import type { IVulnerabilitySummary } from "#api/services/Vulnerability/index.js";
import { OsvCacheService } from "#api/services/Vulnerability/index.js";
import { vulnerabilities, teams, teamProjects } from "#api/db/schema.js";
import { vulnerabilityRoutes } from "../vulnerabilities.js";
import {
    makeVulnerability,
    makeEnrichedVulnerability,
    createMockVulnerabilityService,
    createMockOsvCacheService,
    makeVulnerabilityDetail,
    makeOsvEnrichedDetail,
    createTestContext,
    insertTestProject,
    seedVulnerabilities
} from "./vulnerabilities.testHelpers.js";
import type { TestDb } from "./vulnerabilities.testHelpers.js";

describe("vulnerability routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let vulnerabilityService: VulnerabilityService.Interface;
    let osvCacheService: OsvCacheService.Interface;
    let token: string;

    beforeEach(async () => {
        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;
        vulnerabilityService = createMockVulnerabilityService();
        osvCacheService = createMockOsvCacheService();
        container.registerInstance(VulnerabilityService, vulnerabilityService);
        container.registerInstance(OsvCacheService, osvCacheService);

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
