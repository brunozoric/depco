import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { seedYarnSecuritySettings } from "#testing/helpers/seedYarnSecuritySettings.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { projects, securityChecks, scanResults, teams, teamProjects } from "#api/db/schema.js";
import {
    setupProjectsTest,
    teardownProjectsTest,
    driveJobToCompletion,
    type ProjectsTestContext
} from "./projectsTestHelpers.js";

describe("project routes - detail", () => {
    let ctx: ProjectsTestContext;
    let app: FastifyInstance;
    let testDir: string;
    let db: ReturnType<typeof createTestApiContainer>["db"];
    let jobWorker: JobWorker.Interface;
    let token: string;

    beforeEach(async () => {
        ctx = await setupProjectsTest();
        ({ app, testDir, db, jobWorker, token } = ctx);
    });

    afterEach(async () => {
        await teardownProjectsTest(ctx);
    });

    it("POST /api/projects/:id/scan enqueues an async scan job and persists results to the DB", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/scan"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { jobId: string } };
        expect(body.item.jobId).toBeDefined();

        const job = await driveJobToCompletion(jobWorker, body.item.jobId);
        expect(job.status).toBe("completed");

        const updated = await db.select().from(projects).where(eq(projects.id, "p1")).get();
        expect(updated?.lastScannedAt).not.toBeNull();

        const dependenciesResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/dependencies"
        });
        expect(dependenciesResponse.statusCode).toBe(200);
    }, 10000);

    it("POST /api/projects/:id/scan returns 404 for unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/unknown/scan"
        });

        expect(response.statusCode).toBe(404);
    });

    it("GET /api/projects/:id/dependencies returns the persisted scan results for a project", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: "/tmp/test",
                addedAt: Date.now()
            })
            .run();

        await db
            .insert(scanResults)
            .values({
                id: "sr1",
                projectId: "p1",
                name: "react",
                currentVersion: "18.0.0",
                latestVersion: "19.0.0",
                latestInRange: "18.5.0",
                type: "dependency",
                upgradeType: "major",
                scannedAt: Date.now()
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/dependencies"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as {
            items: Array<{
                name: string;
                currentVersion: string;
                latestVersion: string;
            }>;
            total: number;
        };
        expect(body.items).toHaveLength(1);
        expect(body.total).toBe(1);
        expect(body.items[0]?.name).toBe("react");
        expect(body.items[0]?.currentVersion).toBe("18.0.0");
        expect(body.items[0]?.latestVersion).toBe("19.0.0");
    });

    it("GET /api/projects/:id/dependencies returns empty when no scan has run", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: "/tmp/test",
                addedAt: Date.now()
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/dependencies"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { items: unknown[]; total: number };
        expect(body.items).toEqual([]);
        expect(body.total).toBe(0);
    });

    it("GET /api/projects/:id/dependencies returns 404 for unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/unknown/dependencies"
        });

        expect(response.statusCode).toBe(404);
    });

    it("GET /api/projects/:id/dependencies filters by dependencyKind", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: "/tmp/test",
                addedAt: Date.now()
            })
            .run();

        await db
            .insert(scanResults)
            .values([
                {
                    id: "sr1",
                    projectId: "p1",
                    name: "react",
                    currentVersion: "18.0.0",
                    type: "dependency",
                    dependencyKind: "dependency",
                    scannedAt: Date.now()
                },
                {
                    id: "sr2",
                    projectId: "p1",
                    name: "picomatch",
                    currentVersion: "2.3.1",
                    type: "dependency",
                    dependencyKind: "transitive",
                    scannedAt: Date.now()
                }
            ])
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/dependencies?dependencyKind=transitive"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { items: Array<{ name: string }>; total: number };
        expect(body.total).toBe(1);
        expect(body.items[0]?.name).toBe("picomatch");
    });

    it("GET /api/projects/:id/dependencies filters by registryResolved", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: "/tmp/test",
                addedAt: Date.now()
            })
            .run();

        await db
            .insert(scanResults)
            .values([
                {
                    id: "sr1",
                    projectId: "p1",
                    name: "react",
                    currentVersion: "18.0.0",
                    type: "dependency",
                    dependencyKind: "transitive",
                    registryResolved: 1,
                    scannedAt: Date.now()
                },
                {
                    id: "sr2",
                    projectId: "p1",
                    name: "picomatch",
                    currentVersion: "2.3.1",
                    type: "dependency",
                    dependencyKind: "transitive",
                    registryResolved: 0,
                    scannedAt: Date.now()
                }
            ])
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/dependencies?registryResolved=false"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as {
            items: Array<{ name: string; registryResolved: boolean }>;
            total: number;
        };
        expect(body.total).toBe(1);
        expect(body.items[0]?.name).toBe("picomatch");
        expect(body.items[0]?.registryResolved).toBe(false);
    });

    it("GET /api/projects/:id/transitive-resolve-status returns counts for transitive deps", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: "/tmp/test",
                addedAt: Date.now()
            })
            .run();

        await db
            .insert(scanResults)
            .values([
                {
                    id: "sr1",
                    projectId: "p1",
                    name: "react",
                    currentVersion: "18.0.0",
                    type: "dependency",
                    dependencyKind: "dependency",
                    registryResolved: 1,
                    scannedAt: Date.now()
                },
                {
                    id: "sr2",
                    projectId: "p1",
                    name: "picomatch",
                    currentVersion: "2.3.1",
                    type: "dependency",
                    dependencyKind: "transitive",
                    registryResolved: 1,
                    scannedAt: Date.now()
                },
                {
                    id: "sr3",
                    projectId: "p1",
                    name: "braces",
                    currentVersion: "3.0.2",
                    type: "dependency",
                    dependencyKind: "transitive",
                    registryResolved: 0,
                    scannedAt: Date.now()
                }
            ])
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/transitive-resolve-status"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { total: number; resolved: number; pending: number };
        expect(body.total).toBe(2);
        expect(body.resolved).toBe(1);
        expect(body.pending).toBe(1);
    });

    it("GET /api/projects/:id/transitive-resolve-status returns 404 for unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/unknown/transitive-resolve-status"
        });

        expect(response.statusCode).toBe(404);
    });

    it("GET /api/projects/:id/security returns null when no check has run", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                addedAt: Date.now()
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/security"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ item: null });
    });

    it("GET /api/projects/:id/security returns the latest persisted check", async () => {
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                addedAt: Date.now()
            })
            .run();

        await db
            .insert(securityChecks)
            .values({
                id: "sc1",
                projectId: "p1",
                checkedAt: Date.now(),
                results: JSON.stringify({ enableScripts: true }),
                passes: 1
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/security"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { passes: boolean } };
        expect(body.item.passes).toBe(true);
    });

    it("GET /api/projects/:id/security returns 404 for unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/unknown/security"
        });

        expect(response.statusCode).toBe(404);
    });

    it("POST /api/projects/:id/security runs a fresh check and returns result", async () => {
        await seedYarnSecuritySettings(db);

        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/security"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { passes: boolean } };
        expect(body.item.passes).toBe(true);
    });

    it("POST /api/projects/:id/security returns 404 for unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/unknown/security"
        });

        expect(response.statusCode).toBe(404);
    });

    describe("project team assignment", () => {
        async function insertTeam(name: string, color = "#ff0000"): Promise<string> {
            const id = generateId();
            await db.insert(teams).values({ id, name, color, createdAt: Date.now() }).run();
            return id;
        }

        beforeEach(async () => {
            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: "/tmp/test",
                    addedAt: Date.now()
                })
                .run();
        });

        it("GET /api/projects/:id/teams returns 2 assigned teams", async () => {
            const platformId = await insertTeam("Platform");
            const growthId = await insertTeam("Growth");
            await db
                .insert(teamProjects)
                .values([
                    { id: generateId(), teamId: platformId, projectId: "p1" },
                    { id: generateId(), teamId: growthId, projectId: "p1" }
                ])
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/projects/p1/teams"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json() as {
                items: Array<{ id: string; name: string; color: string }>;
                total: number;
            };
            expect(body.total).toBe(2);
            expect(body.items.map(item => item.name).sort()).toEqual(["Growth", "Platform"]);
        });

        it("GET /api/projects/:id/teams returns empty when no teams assigned", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/projects/p1/teams"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ items: [], total: 0 });
        });

        it("PUT /api/projects/:id/teams assigns teams to a project", async () => {
            const platformId = await insertTeam("Platform");
            const growthId = await insertTeam("Growth");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/projects/p1/teams",
                payload: { teamIds: [platformId, growthId] }
            });

            expect(response.statusCode).toBe(200);

            const rows = await db
                .select()
                .from(teamProjects)
                .where(eq(teamProjects.projectId, "p1"))
                .all();
            expect(rows.map(row => row.teamId).sort()).toEqual([growthId, platformId].sort());
        });

        it("PUT /api/projects/:id/teams deduplicates repeated teamIds", async () => {
            const platformId = await insertTeam("Platform");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/projects/p1/teams",
                payload: { teamIds: [platformId, platformId, platformId] }
            });

            expect(response.statusCode).toBe(200);

            const rows = await db
                .select()
                .from(teamProjects)
                .where(eq(teamProjects.projectId, "p1"))
                .all();
            expect(rows).toHaveLength(1);
            expect(rows[0]?.teamId).toBe(platformId);
        });

        it("PUT /api/projects/:id/teams replaces existing assignments", async () => {
            const platformId = await insertTeam("Platform");
            const growthId = await insertTeam("Growth");
            await db
                .insert(teamProjects)
                .values({ id: generateId(), teamId: platformId, projectId: "p1" })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/projects/p1/teams",
                payload: { teamIds: [growthId] }
            });

            expect(response.statusCode).toBe(200);

            const rows = await db
                .select()
                .from(teamProjects)
                .where(eq(teamProjects.projectId, "p1"))
                .all();
            expect(rows).toHaveLength(1);
            expect(rows[0]?.teamId).toBe(growthId);
        });

        it("PUT /api/projects/:id/teams with empty teamIds removes all assignments", async () => {
            const platformId = await insertTeam("Platform");
            await db
                .insert(teamProjects)
                .values({ id: generateId(), teamId: platformId, projectId: "p1" })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/projects/p1/teams",
                payload: { teamIds: [] }
            });

            expect(response.statusCode).toBe(200);

            const rows = await db
                .select()
                .from(teamProjects)
                .where(eq(teamProjects.projectId, "p1"))
                .all();
            expect(rows).toHaveLength(0);
        });

        it("PUT /api/projects/:id/teams returns 404 when project not found", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/projects/unknown/teams",
                payload: { teamIds: [] }
            });

            expect(response.statusCode).toBe(404);
        });
    });
});
