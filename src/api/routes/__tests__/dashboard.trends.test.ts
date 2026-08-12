import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import {
    projects,
    healthSnapshots,
    licenseSnapshots,
    autoFixPullRequests
} from "#api/db/schema.js";
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
});
