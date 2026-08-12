import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join, basename } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { seedYarnSecuritySettings } from "#testing/helpers/seedYarnSecuritySettings.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { ErrorReporter } from "../../services/ErrorReporter/index.js";
import { ScanSchedulerService } from "../../services/ScanScheduler/index.js";
import { EmailService } from "../../services/Email/index.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { projectRoutes } from "../projects.js";
import {
    projects,
    upgradeJobs,
    securityChecks,
    scanResults,
    teams,
    teamProjects
} from "#api/db/schema.js";

const VALID_YARNRC = [
    "npmPreapprovedPackages: []",
    "npmMinimalAgeGate: 3d",
    "enableScripts: false",
    "approvedGitRepositories: []"
].join("\n");

const TERMINAL_JOB_STATUSES = new Set(["completed", "failed", "cancelled", "interrupted"]);

// The "scan" job is now a thin orchestrator that chains child jobs
// (package-scan, then vulnerability-scan/license-scan/graph-refresh in
// parallel) via JobWorker.enqueue()/waitForJob(). A single
// processNextJob()+drain() pass only starts whichever jobs are already
// pending at that instant — it doesn't pick up children enqueued *during*
// that pass. In production, a setInterval drives processNextJob() on a
// timer so newly-enqueued children eventually get picked up; this helper
// mirrors that by polling until the given job reaches a terminal state.
async function driveJobToCompletion(
    worker: JobWorker.Interface,
    jobId: string,
    timeoutMs = 4000
): Promise<JobWorker.Job> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        await worker.processNextJob();
        const job = await worker.getJob(jobId);
        if (job && TERMINAL_JOB_STATUSES.has(job.status)) {
            await worker.drain();
            return job;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Job ${jobId} did not reach a terminal state within ${timeoutMs}ms`);
}

interface ScanSchedulerServiceMock {
    init: ReturnType<typeof vi.fn<() => Promise<void>>>;
    stop: ReturnType<typeof vi.fn<() => Promise<void>>>;
    scheduleProject: ReturnType<typeof vi.fn<(projectId: string) => Promise<void>>>;
    unscheduleProject: ReturnType<typeof vi.fn<(projectId: string) => Promise<void>>>;
    onGlobalDefaultChanged: ReturnType<typeof vi.fn<() => Promise<void>>>;
    onScanComplete: ReturnType<typeof vi.fn<(projectId: string) => Promise<void>>>;
}

describe("project routes", () => {
    let app: FastifyInstance;
    let testDir: string;
    let db: ReturnType<typeof createTestApiContainer>["db"];
    let jobWorker: JobWorker.Interface;
    let scanSchedulerMock: ScanSchedulerServiceMock;
    let token: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "my-test-project" }));
        writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);
        writeFileSync(join(testDir, "yarn.lock"), "");

        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;

        container.registerInstance(CommandRunner, {
            run: async (_command: string, args: string[]) => {
                if (args[0] === "--version") {
                    return { stdout: "4.17.1\n", stderr: "", exitCode: 0 };
                }
                if (args[0] === "info") {
                    return { stdout: "", stderr: "", exitCode: 0 };
                }
                return { stdout: "{}\n", stderr: "", exitCode: 0 };
            },
            runStreaming: async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            })
        });
        container.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        scanSchedulerMock = {
            init: vi.fn(),
            stop: vi.fn(),
            scheduleProject: vi.fn(),
            unscheduleProject: vi.fn(),
            onGlobalDefaultChanged: vi.fn(),
            onScanComplete: vi.fn()
        };
        container.registerInstance(ScanSchedulerService, scanSchedulerMock);
        container.registerInstance(EmailService, { send: vi.fn() });

        jobWorker = container.resolve(JobWorker);

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(projectRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
        rmSync(testDir, { recursive: true, force: true });
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
