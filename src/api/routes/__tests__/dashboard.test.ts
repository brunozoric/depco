import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { generateId } from "@webiny/stdlib";
import {
    projects,
    healthSnapshots,
    upgradeJobs,
    securityChecks,
    licenseSnapshots,
    autoFixPullRequests,
    dependencyChanges,
    teams,
    teamProjects
} from "#api/db/schema.js";
import { dashboardRoutes } from "../dashboard.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

describe("Dashboard Routes", () => {
    let db: TestDb;
    let app: FastifyInstance;

    beforeEach(async () => {
        db = await createTestDb();
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        app = Fastify();
        await app.register(dashboardRoutes, { container });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    describe("GET /api/dashboard/health", () => {
        it("should return empty summary when no projects exist", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/health"
            });
            const body = JSON.parse(response.body);
            expect(response.statusCode).toBe(200);
            expect(body.summary.totalProjects).toBe(0);
            expect(body.summary.averageScore).toBe(0);
            expect(body.summary.worstProject).toBeNull();
            expect(body.projects).toEqual([]);
        });

        it("should return project health sorted by score ascending", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            const today = new Date().toISOString().slice(0, 10);
            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        date: today,
                        score: 90,
                        totalPackages: 10,
                        upToDate: 9,
                        patchOutdated: 1,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        date: today,
                        score: 50,
                        totalPackages: 10,
                        upToDate: 5,
                        patchOutdated: 2,
                        minorOutdated: 2,
                        majorOutdated: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({ method: "GET", url: "/api/dashboard/health" });
            const body = JSON.parse(response.body);

            expect(body.projects[0].projectName).toBe("project-b");
            expect(body.projects[1].projectName).toBe("project-a");
            expect(body.summary.worstProject.name).toBe("project-b");
            expect(body.summary.averageScore).toBe(70);
        });

        it("should filter to only the team's assigned projects when teamId is given", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            const today = new Date().toISOString().slice(0, 10);
            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        date: today,
                        score: 90,
                        totalPackages: 10,
                        upToDate: 9,
                        patchOutdated: 1,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        date: today,
                        score: 50,
                        totalPackages: 10,
                        upToDate: 5,
                        patchOutdated: 2,
                        minorOutdated: 2,
                        majorOutdated: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const teamId = generateId();
            await db
                .insert(teams)
                .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
                .run();
            await db
                .insert(teamProjects)
                .values({ id: generateId(), teamId, projectId: projectA.id })
                .run();

            const response = await app.inject({
                method: "GET",
                url: `/api/dashboard/health?teamId=${teamId}`
            });
            const body = JSON.parse(response.body);

            expect(response.statusCode).toBe(200);
            expect(body.projects).toHaveLength(1);
            expect(body.projects[0].projectName).toBe("project-a");
            expect(body.summary.totalProjects).toBe(1);
        });
    });

    describe("GET /api/dashboard/health/trend", () => {
        it("should return snapshots within range", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: "2026-07-30",
                        score: 80,
                        totalPackages: 10,
                        upToDate: 8,
                        patchOutdated: 2,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: "2026-06-01",
                        score: 60,
                        totalPackages: 10,
                        upToDate: 6,
                        patchOutdated: 2,
                        minorOutdated: 1,
                        majorOutdated: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/health/trend?range=7d"
            });
            const body = JSON.parse(response.body);

            expect(body.items).toHaveLength(1);
            expect(body.items[0].snapshots).toHaveLength(1);
            expect(body.items[0].snapshots[0].date).toBe("2026-07-30");
        });

        it("should return all snapshots when range is all", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: "2026-07-30",
                        score: 80,
                        totalPackages: 10,
                        upToDate: 8,
                        patchOutdated: 2,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: "2026-01-01",
                        score: 40,
                        totalPackages: 10,
                        upToDate: 4,
                        patchOutdated: 3,
                        minorOutdated: 2,
                        majorOutdated: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/health/trend?range=all"
            });
            const body = JSON.parse(response.body);

            expect(body.items[0].snapshots).toHaveLength(2);
        });
    });

    describe("GET /api/dashboard/activity", () => {
        it("should return recent jobs sorted by startedAt descending", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            await db
                .insert(upgradeJobs)
                .values([
                    {
                        id: generateId(),
                        referenceId: project.id,
                        referenceType: "project",
                        type: "scan",
                        status: "completed",
                        startedAt: 1000,
                        completedAt: 2000
                    },
                    {
                        id: generateId(),
                        referenceId: project.id,
                        referenceType: "project",
                        type: "dependency",
                        status: "completed",
                        startedAt: 3000,
                        completedAt: 4000
                    }
                ])
                .run();

            const response = await app.inject({ method: "GET", url: "/api/dashboard/activity" });
            const body = JSON.parse(response.body);

            expect(body.items).toHaveLength(2);
            expect(body.items[0].startedAt).toBe(3000);
        });

        it("should limit to 20 jobs", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            const jobs = Array.from({ length: 25 }, (_, i) => ({
                id: generateId(),
                referenceId: project.id,
                referenceType: "project",
                type: "scan",
                status: "completed",
                startedAt: i * 1000,
                completedAt: i * 1000 + 500
            }));
            await db.insert(upgradeJobs).values(jobs).run();

            const response = await app.inject({ method: "GET", url: "/api/dashboard/activity" });
            const body = JSON.parse(response.body);

            expect(body.items).toHaveLength(20);
        });
    });

    describe("GET /api/dashboard/staleness", () => {
        it("should return projects sorted by lastScannedAt ascending with nulls first", async () => {
            await db
                .insert(projects)
                .values([
                    {
                        id: generateId(),
                        name: "recent",
                        path: "/recent",
                        addedAt: Date.now(),
                        lastScannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        name: "never-scanned",
                        path: "/never",
                        addedAt: Date.now(),
                        lastScannedAt: null
                    },
                    {
                        id: generateId(),
                        name: "old",
                        path: "/old",
                        addedAt: Date.now(),
                        lastScannedAt: 1000
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/staleness"
            });
            const body = JSON.parse(response.body);

            expect(body.items[0].projectName).toBe("never-scanned");
            expect(body.items[0].lastScannedAt).toBeNull();
            expect(body.items[1].projectName).toBe("old");
        });
    });

    describe("GET /api/dashboard/security", () => {
        it("should return aggregate security results sorted by passing ratio ascending", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            await db
                .insert(securityChecks)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        checkedAt: Date.now(),
                        results: JSON.stringify([{ pass: true }, { pass: true }, { pass: false }]),
                        passes: 2
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        checkedAt: Date.now(),
                        results: JSON.stringify([{ pass: true }, { pass: true }]),
                        passes: 2
                    }
                ])
                .run();

            const response = await app.inject({ method: "GET", url: "/api/dashboard/security" });
            const body = JSON.parse(response.body);

            expect(body.items).toHaveLength(2);
        });
    });

    describe("GET /api/dashboard/vuln-trend", () => {
        it("returns aggregated vulnerability counts per date from healthSnapshots", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        date: "2026-07-01",
                        vulnerabilityCritical: 2,
                        vulnerabilityHigh: 3,
                        vulnerabilityModerate: 1,
                        vulnerabilityLow: 0,
                        score: 80,
                        totalPackages: 10,
                        upToDate: 8,
                        patchOutdated: 2,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        date: "2026-07-01",
                        vulnerabilityCritical: 1,
                        vulnerabilityHigh: 0,
                        vulnerabilityModerate: 2,
                        vulnerabilityLow: 1,
                        score: 75,
                        totalPackages: 10,
                        upToDate: 7,
                        patchOutdated: 3,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        date: "2026-07-02",
                        vulnerabilityCritical: 0,
                        vulnerabilityHigh: 1,
                        vulnerabilityModerate: 0,
                        vulnerabilityLow: 2,
                        score: 85,
                        totalPackages: 10,
                        upToDate: 9,
                        patchOutdated: 1,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/vuln-trend"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            const { points } = body;
            expect(points).toHaveLength(2);
            expect(points[0]).toEqual({
                date: "2026-07-01",
                critical: 3,
                high: 3,
                moderate: 3,
                low: 1
            });
            expect(points[1]).toEqual({
                date: "2026-07-02",
                critical: 0,
                high: 1,
                moderate: 0,
                low: 2
            });
        });

        it("filters by days param", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            const today = new Date().toISOString().slice(0, 10);
            const thirtyDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);

            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: today,
                        vulnerabilityCritical: 1,
                        vulnerabilityHigh: 0,
                        vulnerabilityModerate: 0,
                        vulnerabilityLow: 0,
                        score: 80,
                        totalPackages: 10,
                        upToDate: 8,
                        patchOutdated: 2,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: thirtyDaysAgo,
                        vulnerabilityCritical: 5,
                        vulnerabilityHigh: 0,
                        vulnerabilityModerate: 0,
                        vulnerabilityLow: 0,
                        score: 60,
                        totalPackages: 10,
                        upToDate: 6,
                        patchOutdated: 2,
                        minorOutdated: 1,
                        majorOutdated: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/vuln-trend?days=7"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            const { points } = body;
            expect(points).toHaveLength(1);
            expect(points[0].date).toBe(today);
        });

        it("returns empty array when no snapshots exist", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/vuln-trend"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.points).toEqual([]);
        });
    });

    describe("GET /api/dashboard/staleness-trend", () => {
        it("returns aggregated staleness counts per date from healthSnapshots", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        date: "2026-07-01",
                        score: 80,
                        totalPackages: 10,
                        upToDate: 7,
                        patchOutdated: 2,
                        minorOutdated: 1,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        date: "2026-07-01",
                        score: 70,
                        totalPackages: 8,
                        upToDate: 5,
                        patchOutdated: 1,
                        minorOutdated: 1,
                        majorOutdated: 1,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        date: "2026-07-02",
                        score: 85,
                        totalPackages: 10,
                        upToDate: 9,
                        patchOutdated: 1,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/staleness-trend"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            const { points } = body;
            expect(points).toHaveLength(2);
            expect(points[0]).toEqual({
                date: "2026-07-01",
                patchOutdated: 3,
                minorOutdated: 2,
                majorOutdated: 1,
                totalPackages: 18
            });
            expect(points[1]).toEqual({
                date: "2026-07-02",
                patchOutdated: 1,
                minorOutdated: 0,
                majorOutdated: 0,
                totalPackages: 10
            });
        });

        it("filters by days param", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            const today = new Date().toISOString().slice(0, 10);
            const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000)
                .toISOString()
                .slice(0, 10);

            await db
                .insert(healthSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: today,
                        score: 80,
                        totalPackages: 10,
                        upToDate: 8,
                        patchOutdated: 2,
                        minorOutdated: 0,
                        majorOutdated: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: thirtyOneDaysAgo,
                        score: 60,
                        totalPackages: 10,
                        upToDate: 6,
                        patchOutdated: 2,
                        minorOutdated: 1,
                        majorOutdated: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/staleness-trend?days=7"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.points).toHaveLength(1);
            expect(body.points[0].date).toBe(today);
        });
    });

    describe("GET /api/dashboard/license-trend", () => {
        it("returns aggregated license compliance counts per date", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            await db
                .insert(licenseSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        date: "2026-07-01",
                        totalPackages: 10,
                        compliantCount: 8,
                        deniedCount: 1,
                        warnedCount: 1,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        date: "2026-07-01",
                        totalPackages: 6,
                        compliantCount: 5,
                        deniedCount: 0,
                        warnedCount: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/license-trend"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            const { points } = body;
            expect(points).toHaveLength(1);
            expect(points[0]).toEqual({
                date: "2026-07-01",
                compliantCount: 13,
                deniedCount: 1,
                warnedCount: 2,
                totalPackages: 16
            });
        });

        it("filters by days param", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            const today = new Date().toISOString().slice(0, 10);
            const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000)
                .toISOString()
                .slice(0, 10);

            await db
                .insert(licenseSnapshots)
                .values([
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: today,
                        totalPackages: 5,
                        compliantCount: 5,
                        deniedCount: 0,
                        warnedCount: 0,
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        date: thirtyOneDaysAgo,
                        totalPackages: 5,
                        compliantCount: 3,
                        deniedCount: 1,
                        warnedCount: 1,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/license-trend?days=7"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.points).toHaveLength(1);
            expect(body.points[0].date).toBe(today);
        });

        it("returns empty array when no snapshots exist", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/license-trend"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.points).toEqual([]);
        });
    });

    describe("GET /api/dashboard/auto-fix-trend", () => {
        it("returns pivoted status counts per date derived from updatedAt", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            const dayOneMs = new Date("2026-07-01T12:00:00.000Z").getTime();
            const dayTwoMs = new Date("2026-07-02T12:00:00.000Z").getTime();

            await db
                .insert(autoFixPullRequests)
                .values([
                    {
                        id: generateId(),
                        projectId: project.id,
                        packageNames: JSON.stringify(["left-pad"]),
                        fromVersions: JSON.stringify(["1.0.0"]),
                        toVersions: JSON.stringify(["1.1.0"]),
                        upgradeType: "minor",
                        branchName: "auto-fix/left-pad-1",
                        status: "merged",
                        createdAt: dayOneMs,
                        updatedAt: dayOneMs
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        packageNames: JSON.stringify(["chalk"]),
                        fromVersions: JSON.stringify(["4.0.0"]),
                        toVersions: JSON.stringify(["4.1.0"]),
                        upgradeType: "minor",
                        branchName: "auto-fix/chalk-1",
                        status: "created",
                        createdAt: dayOneMs,
                        updatedAt: dayOneMs
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        packageNames: JSON.stringify(["lodash"]),
                        fromVersions: JSON.stringify(["4.0.0"]),
                        toVersions: JSON.stringify(["4.2.0"]),
                        upgradeType: "minor",
                        branchName: "auto-fix/lodash-1",
                        status: "failed",
                        createdAt: dayTwoMs,
                        updatedAt: dayTwoMs
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/auto-fix-trend"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            const { points } = body;
            expect(points).toHaveLength(2);
            expect(points[0]).toEqual({
                date: "2026-07-01",
                pending: 0,
                created: 1,
                merged: 1,
                closed: 0,
                failed: 0
            });
            expect(points[1]).toEqual({
                date: "2026-07-02",
                pending: 0,
                created: 0,
                merged: 0,
                closed: 0,
                failed: 1
            });
        });

        it("filters by days param using updatedAt epoch conversion", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            const recentMs = Date.now();
            const oldMs = Date.now() - 31 * 86400000;

            await db
                .insert(autoFixPullRequests)
                .values([
                    {
                        id: generateId(),
                        projectId: project.id,
                        packageNames: JSON.stringify(["left-pad"]),
                        fromVersions: JSON.stringify(["1.0.0"]),
                        toVersions: JSON.stringify(["1.1.0"]),
                        upgradeType: "minor",
                        branchName: "auto-fix/left-pad-1",
                        status: "merged",
                        createdAt: recentMs,
                        updatedAt: recentMs
                    },
                    {
                        id: generateId(),
                        projectId: project.id,
                        packageNames: JSON.stringify(["chalk"]),
                        fromVersions: JSON.stringify(["4.0.0"]),
                        toVersions: JSON.stringify(["4.1.0"]),
                        upgradeType: "minor",
                        branchName: "auto-fix/chalk-1",
                        status: "pending",
                        createdAt: oldMs,
                        updatedAt: oldMs
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/auto-fix-trend?days=7"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.points).toHaveLength(1);
            expect(body.points[0].merged).toBe(1);
            expect(body.points[0].pending).toBe(0);
        });
    });

    describe("GET /api/dashboard/dependency-changes", () => {
        it("returns recent dependency changes with total count", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            await db
                .insert(dependencyChanges)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        packageName: "left-pad",
                        changeType: "added",
                        previousVersion: null,
                        newVersion: "1.0.0",
                        detectedAt: 1000
                    },
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        packageName: "chalk",
                        changeType: "version-changed",
                        previousVersion: "4.0.0",
                        newVersion: "4.1.0",
                        detectedAt: 2000
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        packageName: "lodash",
                        changeType: "removed",
                        previousVersion: "4.0.0",
                        newVersion: null,
                        detectedAt: 3000
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/dependency-changes"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.total).toBe(3);
            expect(body.items).toHaveLength(3);
            expect(body.items[0].packageName).toBe("lodash");
            expect(body.items[0].detectedAt).toBe(3000);
        });

        it("filters by projectId", async () => {
            const projectA = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            const projectB = {
                id: generateId(),
                name: "project-b",
                path: "/b",
                addedAt: Date.now()
            };
            await db.insert(projects).values([projectA, projectB]).run();

            await db
                .insert(dependencyChanges)
                .values([
                    {
                        id: generateId(),
                        projectId: projectA.id,
                        packageName: "left-pad",
                        changeType: "added",
                        previousVersion: null,
                        newVersion: "1.0.0",
                        detectedAt: 1000
                    },
                    {
                        id: generateId(),
                        projectId: projectB.id,
                        packageName: "lodash",
                        changeType: "removed",
                        previousVersion: "4.0.0",
                        newVersion: null,
                        detectedAt: 2000
                    }
                ])
                .run();

            const response = await app.inject({
                method: "GET",
                url: `/api/dashboard/dependency-changes?projectId=${projectA.id}`
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.total).toBe(1);
            expect(body.items).toHaveLength(1);
            expect(body.items[0].packageName).toBe("left-pad");
        });

        it("respects the limit param while total reflects all matches", async () => {
            const project = {
                id: generateId(),
                name: "project-a",
                path: "/a",
                addedAt: Date.now()
            };
            await db.insert(projects).values(project).run();

            const changes = Array.from({ length: 5 }, (_, index) => ({
                id: generateId(),
                projectId: project.id,
                packageName: `package-${index}`,
                changeType: "added" as const,
                previousVersion: null,
                newVersion: "1.0.0",
                detectedAt: index * 1000
            }));
            await db.insert(dependencyChanges).values(changes).run();

            const response = await app.inject({
                method: "GET",
                url: "/api/dashboard/dependency-changes?limit=2"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(5);
        });
    });
});
