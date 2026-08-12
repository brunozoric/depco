import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { projects, upgradeJobs, dependencyChanges } from "#api/db/schema.js";
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
