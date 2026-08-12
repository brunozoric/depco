import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { projects, healthSnapshots, securityChecks, teams, teamProjects } from "#api/db/schema.js";
import {
    setupDashboardTest,
    teardownDashboardTest,
    type DashboardTestContext
} from "./dashboardTestHelpers.js";

describe("Dashboard Routes", () => {
    let ctx: DashboardTestContext;
    let db: DashboardTestContext["db"];
    let app: FastifyInstance;

    beforeEach(async () => {
        ctx = await setupDashboardTest();
        ({ app, db } = ctx);
    });

    afterEach(async () => {
        await teardownDashboardTest(ctx);
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
            const today = new Date();
            const recentDate = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);
            const oldDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);

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
                        date: recentDate,
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
                        date: oldDate,
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
            expect(body.items[0].snapshots[0].date).toBe(recentDate);
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
});
