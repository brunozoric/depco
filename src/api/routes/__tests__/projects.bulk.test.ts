import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";
import type { FastifyInstance } from "fastify";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { projects, upgradeJobs } from "#api/db/schema.js";
import {
    setupProjectsTest,
    teardownProjectsTest,
    type ProjectsTestContext
} from "./projectsTestHelpers.js";

describe("project routes - bulk", () => {
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

    it("GET /api/projects/export returns paths of all registered projects", async () => {
        await db
            .insert(projects)
            .values([
                { id: "p1", name: "alpha", path: "/tmp/alpha", addedAt: Date.now() },
                { id: "p2", name: "beta", path: "/tmp/beta", addedAt: Date.now() }
            ])
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/export"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as {
            items: Array<{ path: string }>;
            total: number;
        };
        expect(body.total).toBe(2);
        expect(body.items.map(i => i.path).sort()).toEqual(["/tmp/alpha", "/tmp/beta"]);
    });

    it("GET /api/projects/export returns empty when no projects exist", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/export"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { items: unknown[]; total: number };
        expect(body.items).toEqual([]);
        expect(body.total).toBe(0);
    });

    it("POST /api/projects/import adds new projects and skips existing ones", async () => {
        await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects",
            payload: { path: testDir }
        });

        const secondDir = join(
            tmpdir(),
            `route-test-import-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(secondDir, { recursive: true });
        writeFileSync(join(secondDir, "package.json"), JSON.stringify({ name: "second-project" }));
        writeFileSync(join(secondDir, "yarn.lock"), "");

        try {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/projects/import",
                payload: {
                    items: [{ path: testDir }, { path: secondDir }]
                }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json() as {
                items: Array<{ path: string; status: string }>;
            };
            expect(body.items).toHaveLength(2);

            const existing = body.items.find(i => i.path === testDir);
            expect(existing?.status).toBe("skipped");

            const added = body.items.find(i => i.path === secondDir);
            expect(added?.status).toBe("added");

            const allProjects = await db.select().from(projects).all();
            expect(allProjects).toHaveLength(2);
        } finally {
            rmSync(secondDir, { recursive: true, force: true });
        }
    });

    it("POST /api/projects/import enqueues a scan job for each added project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/import",
            payload: {
                items: [{ path: testDir }]
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as {
            items: Array<{ path: string; status: string }>;
        };
        expect(body.items[0]?.status).toBe("added");

        const allJobs = await jobWorker.listAllJobs();
        const scanJobs = allJobs.filter(j => j.type === "scan");
        expect(scanJobs).toHaveLength(1);
    });

    it("POST /api/projects/import registers projects with null PM for paths without lockfiles", async () => {
        const noLockDir = join(
            tmpdir(),
            `route-test-no-lock-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(noLockDir, { recursive: true });

        try {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/projects/import",
                payload: {
                    items: [{ path: noLockDir }]
                }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json() as {
                items: Array<{ path: string; status: string }>;
            };
            expect(body.items[0]?.status).toBe("added");
        } finally {
            rmSync(noLockDir, { recursive: true, force: true });
        }
    });

    it("POST /api/projects/clone enqueues a clone job", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/clone",
            payload: {
                url: "https://github.com/org/repo.git",
                destination: testDir
            }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { jobId: string } };
        expect(body.item.jobId).toBeDefined();

        const allJobs = await jobWorker.listAllJobs();
        const cloneJobs = allJobs.filter(job => job.type === "clone");
        expect(cloneJobs).toHaveLength(1);
    });

    it("POST /api/projects/clone uses folderName when provided", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/clone",
            payload: {
                url: "https://github.com/org/repo.git",
                destination: testDir,
                folderName: "custom-name"
            }
        });

        expect(response.statusCode).toBe(200);
        const allJobs = await jobWorker.listAllJobs();
        const packages = JSON.parse(allJobs[0]!.packages!);
        expect(packages.destination).toBe(join(testDir, "custom-name"));
    });

    it("POST /api/projects/clone rejects file:// scheme URLs", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/clone",
            payload: {
                url: "file:///etc/passwd",
                destination: testDir
            }
        });

        expect(response.statusCode).toBe(400);
    });

    it("POST /api/projects/clone rejects nonexistent destination", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/clone",
            payload: {
                url: "https://github.com/org/repo.git",
                destination: "/nonexistent/path/xyz"
            }
        });

        expect(response.statusCode).toBe(400);
    });

    it("POST /api/projects/bulk-scan enqueues scans and skips projects with an active scan job", async () => {
        await db
            .insert(projects)
            .values([
                { id: "p1", name: "alpha", path: "/tmp/alpha", addedAt: Date.now() },
                { id: "p2", name: "beta", path: "/tmp/beta", addedAt: Date.now() },
                { id: "p3", name: "gamma", path: "/tmp/gamma", addedAt: Date.now() }
            ])
            .run();

        await db
            .insert(upgradeJobs)
            .values({
                id: "active-job",
                referenceId: "p2",
                referenceType: "project",
                type: "scan",
                status: "running"
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/bulk-scan",
            payload: { projectIds: ["p1", "p2", "p3"] }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { enqueuedCount: number; skippedCount: number };
        expect(body.enqueuedCount).toBe(2);
        expect(body.skippedCount).toBe(1);

        const scanJobs = (await db.select().from(upgradeJobs).all()).filter(
            job => job.type === "scan"
        );
        const enqueuedReferenceIds = scanJobs
            .filter(job => job.id !== "active-job")
            .map(job => job.referenceId)
            .sort();
        expect(enqueuedReferenceIds).toEqual(["p1", "p3"]);
    });

    it("POST /api/projects/bulk-scan enqueues anyway when force is true", async () => {
        await db
            .insert(projects)
            .values({ id: "p1", name: "alpha", path: "/tmp/alpha", addedAt: Date.now() })
            .run();

        await db
            .insert(upgradeJobs)
            .values({
                id: "active-job",
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                status: "pending"
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/bulk-scan",
            payload: { projectIds: ["p1"], force: true }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { enqueuedCount: number; skippedCount: number };
        expect(body.enqueuedCount).toBe(1);
        expect(body.skippedCount).toBe(0);
    });

    it("POST /api/projects/clone rejects already-registered path", async () => {
        // First add a project at testDir
        await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects",
            payload: { path: testDir }
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/clone",
            payload: {
                url: "https://github.com/org/test.git",
                destination: join(testDir, ".."),
                folderName: basename(testDir)
            }
        });

        expect(response.statusCode).toBe(409);
    });
});
