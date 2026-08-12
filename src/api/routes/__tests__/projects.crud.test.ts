import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, upgradeJobs, securityChecks, scanResults } from "#api/db/schema.js";
import {
    setupProjectsTest,
    teardownProjectsTest,
    type ProjectsTestContext,
    type ScanSchedulerServiceMock
} from "./projectsTestHelpers.js";

describe("project routes - crud", () => {
    let ctx: ProjectsTestContext;
    let app: FastifyInstance;
    let testDir: string;
    let db: ReturnType<typeof createTestApiContainer>["db"];
    let scanSchedulerMock: ScanSchedulerServiceMock;
    let token: string;

    beforeEach(async () => {
        ctx = await setupProjectsTest();
        ({ app, testDir, db, scanSchedulerMock, token } = ctx);
    });

    afterEach(async () => {
        await teardownProjectsTest(ctx);
    });

    it("POST /api/projects derives name from package.json and detects yarn version", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects",
            payload: { path: testDir }
        });

        expect(response.statusCode).toBe(201);
        const body = response.json() as {
            item: {
                name: string;
                path: string;
                packageManager: string;
                pmVersion: string;
            };
        };
        expect(body.item.name).toBe("my-test-project");
        expect(body.item.path).toBe(testDir);
        expect(body.item.packageManager).toBe("yarn");
        expect(body.item.pmVersion).toBe("4.17.1");

        const stored = await db.select().from(projects).where(eq(projects.path, testDir)).get();
        expect(stored?.packageManager).toBe("yarn");
        expect(stored?.pmVersion).toBe("4.17.1");
    });

    it("POST /api/projects falls back to directory name when package.json is missing", async () => {
        const noPackageDir = join(
            tmpdir(),
            `route-test-no-pkg-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(noPackageDir, { recursive: true });
        writeFileSync(join(noPackageDir, "yarn.lock"), "");

        try {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/projects",
                payload: { path: noPackageDir }
            });

            expect(response.statusCode).toBe(201);
            const body = response.json() as { item: { name: string } };
            expect(body.item.name).toBe(noPackageDir.split("/").pop());
        } finally {
            rmSync(noPackageDir, { recursive: true, force: true });
        }
    });

    it("POST /api/projects registers project with null packageManager when no lockfile is found", async () => {
        const emptyDir = join(
            tmpdir(),
            `route-test-empty-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(emptyDir, { recursive: true });

        try {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/projects",
                payload: { path: emptyDir }
            });

            expect(response.statusCode).toBe(201);
            const body = response.json() as {
                item: { packageManager: string | null };
            };
            expect(body.item.packageManager).toBeNull();
        } finally {
            rmSync(emptyDir, { recursive: true, force: true });
        }
    });

    it("GET /api/projects lists all projects with latest security status", async () => {
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
            url: "/api/projects"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as {
            items: Array<{ id: string; security: { passes: boolean } | null }>;
            total: number;
        };
        expect(body.items).toHaveLength(1);
        expect(body.total).toBe(1);
        expect(body.items[0]?.security?.passes).toBe(true);
    });

    it("GET /api/projects/:id returns a single project", async () => {
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
            url: "/api/projects/p1"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { id: string } };
        expect(body.item.id).toBe("p1");
    });

    it("GET /api/projects/:id returns 404 for unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/unknown"
        });

        expect(response.statusCode).toBe(404);
    });

    it("DELETE /api/projects/:id removes project and cascades", async () => {
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
            .insert(securityChecks)
            .values({
                id: "sc1",
                projectId: "p1",
                checkedAt: Date.now(),
                results: JSON.stringify({ enableScripts: true }),
                passes: 1
            })
            .run();

        await db
            .insert(upgradeJobs)
            .values({
                id: "j1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "completed"
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
            method: "DELETE",
            url: "/api/projects/p1"
        });

        expect(response.statusCode).toBe(204);

        expect(await db.select().from(projects).all()).toHaveLength(0);
        expect(await db.select().from(upgradeJobs).all()).toHaveLength(0);
        expect(await db.select().from(securityChecks).all()).toHaveLength(0);
        expect(await db.select().from(scanResults).all()).toHaveLength(0);
        expect(scanSchedulerMock.unscheduleProject).toHaveBeenCalledWith("p1");
    });

    it("DELETE returns 409 when a job is running", async () => {
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
            .insert(upgradeJobs)
            .values({
                id: "j1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "running"
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: "/api/projects/p1"
        });

        expect(response.statusCode).toBe(409);
        expect(await db.select().from(projects).all()).toHaveLength(1);
    });
});
