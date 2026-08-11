import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import {
    seedYarnSecuritySettings,
    VALID_YARNRC
} from "#testing/helpers/seedYarnSecuritySettings.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { ErrorReporter } from "../../services/ErrorReporter/index.js";
import { ScanSchedulerService } from "../../services/ScanScheduler/index.js";
import { EmailService } from "../../services/Email/index.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { packageManagerRoutes } from "../packageManager.js";
import { projects } from "#api/db/schema.js";

describe("package manager routes", () => {
    let app: FastifyInstance;
    let testDir: string;
    let db: ReturnType<typeof createTestApiContainer>["db"];
    let token: string;

    beforeEach(async () => {
        testDir = join(
            tmpdir(),
            `package-manager-route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);

        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;

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

        container.registerInstance(CommandRunner, {
            run: vi.fn(async (_command: string, args: string[]) => {
                if (args[0] === "--version") {
                    return { stdout: "4.17.1\n", stderr: "", exitCode: 0 };
                }
                return { stdout: "", stderr: "", exitCode: 0 };
            }),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        });
        container.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        container.registerInstance(ScanSchedulerService, {
            init: vi.fn(),
            stop: vi.fn(),
            scheduleProject: vi.fn(),
            unscheduleProject: vi.fn(),
            onGlobalDefaultChanged: vi.fn(),
            onScanComplete: vi.fn()
        });
        container.registerInstance(EmailService, { send: vi.fn() });

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(packageManagerRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
        rmSync(testDir, { recursive: true, force: true });
    });

    it("GET /api/projects/:id/package-manager returns the current version", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/package-manager"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { version: string } };
        expect(body.item.version).toBe("4.17.1");
    });

    it("GET /api/projects/:id/package-manager returns 404 for an unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/unknown/package-manager"
        });

        expect(response.statusCode).toBe(404);
    });

    it("POST /api/projects/:id/package-manager/update enqueues a packageManager-type job", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/package-manager/update",
            payload: { version: "4.20.0" }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { jobId: string } };
        expect(body.item.jobId).toBeDefined();

        const jobResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/package-manager"
        });
        expect(jobResponse.statusCode).toBe(200);
    });

    it("POST /api/projects/:id/package-manager/update captures `from` as the current version and `to` as the requested version", async () => {
        const localResult = createTestApiContainer();
        const localContainer = localResult.container;

        localContainer.registerInstance(CommandRunner, {
            run: vi.fn(async () => ({ stdout: "4.17.1\n", stderr: "", exitCode: 0 })),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        });
        localContainer.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        localContainer.registerInstance(ScanSchedulerService, {
            init: vi.fn(),
            stop: vi.fn(),
            scheduleProject: vi.fn(),
            unscheduleProject: vi.fn(),
            onGlobalDefaultChanged: vi.fn(),
            onScanComplete: vi.fn()
        });
        localContainer.registerInstance(EmailService, { send: vi.fn() });

        // Seed the local db with the same data
        await seedYarnSecuritySettings(localResult.db);
        await localResult.db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const jobWorker = localContainer.resolve(JobWorker);

        const localApp = Fastify();
        localApp.addHook("onRequest", createAuthHook(localContainer));
        await localApp.register(packageManagerRoutes, { container: localContainer });
        await localApp.ready();

        const { token: localToken } = await createTestSession({ db: localResult.db });

        const response = await localApp.inject({
            headers: { authorization: `Bearer ${localToken}` },
            method: "POST",
            url: "/api/projects/p1/package-manager/update",
            payload: { version: "4.20.0" }
        });
        const { item } = response.json() as { item: { jobId: string } };

        const job = await jobWorker.getJob(item.jobId);
        expect(job?.packages).toContain('"from":"4.17.1"');
        expect(job?.packages).toContain('"to":"4.20.0"');

        await localApp.close();
    });

    it("returns 404 when updating the package manager for an unknown project", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/unknown/package-manager/update",
            payload: { version: "4.20.0" }
        });

        expect(response.statusCode).toBe(404);
    });

    it("POST update falls back to the project's stored pmVersion when getVersion throws", async () => {
        await db
            .insert(projects)
            .values({
                id: "p2",
                name: "test-p2",
                path: `${testDir}-p2`,
                packageManager: "yarn",
                pmVersion: "3.9.9",
                addedAt: Date.now()
            })
            .run();

        const localResult = createTestApiContainer();
        const localContainer = localResult.container;

        localContainer.registerInstance(CommandRunner, {
            run: vi.fn(async (_command: string, args: string[]) => {
                if (args[0] === "--version") {
                    throw new Error("command not found");
                }
                return { stdout: "", stderr: "", exitCode: 0 };
            }),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        });
        localContainer.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        localContainer.registerInstance(ScanSchedulerService, {
            init: vi.fn(),
            stop: vi.fn(),
            scheduleProject: vi.fn(),
            unscheduleProject: vi.fn(),
            onGlobalDefaultChanged: vi.fn(),
            onScanComplete: vi.fn()
        });
        localContainer.registerInstance(EmailService, { send: vi.fn() });

        // Seed the local db with the same project data
        await seedYarnSecuritySettings(localResult.db);
        await localResult.db
            .insert(projects)
            .values({
                id: "p2",
                name: "test-p2",
                path: `${testDir}-p2`,
                packageManager: "yarn",
                pmVersion: "3.9.9",
                addedAt: Date.now()
            })
            .run();

        const jobWorker = localContainer.resolve(JobWorker);

        const localApp = Fastify();
        localApp.addHook("onRequest", createAuthHook(localContainer));
        await localApp.register(packageManagerRoutes, { container: localContainer });
        await localApp.ready();

        const { token: localToken } = await createTestSession({ db: localResult.db });

        const response = await localApp.inject({
            headers: { authorization: `Bearer ${localToken}` },
            method: "POST",
            url: "/api/projects/p2/package-manager/update",
            payload: { version: "4.20.0" }
        });

        expect(response.statusCode).toBe(200);
        const { item } = response.json() as { item: { jobId: string } };

        const job = await jobWorker.getJob(item.jobId);
        expect(job?.packages).toContain('"from":"3.9.9"');
        expect(job?.packages).toContain('"to":"4.20.0"');

        await localApp.close();
    });

    it("POST update returns 403 when enqueue fails the security check", async () => {
        const localResult = createTestApiContainer();
        const localContainer = localResult.container;

        localContainer.registerInstance(CommandRunner, {
            run: vi.fn(async () => ({ stdout: "4.17.1\n", stderr: "", exitCode: 0 })),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        });
        localContainer.registerInstance(JobWorker, {
            enqueue: vi.fn(async () => {
                throw new Error("Security check failed");
            }),
            getJob: vi.fn(async () => null),
            getJobsForReference: vi.fn(async () => []),
            processNextJob: vi.fn(async () => {}),
            cancelJob: vi.fn(async () => {}),
            listAllJobs: vi.fn(async () => []),
            drain: vi.fn(async () => {}),
            recoverStaleJobs: vi.fn(async () => {}),
            waitForJob: vi.fn(async () => {
                throw new Error("not implemented");
            }),
            waitForJobs: vi.fn(async () => []),
            getRunningJobsForReference: vi.fn(async () => [])
        });
        localContainer.registerInstance(EmailService, { send: vi.fn() });

        // Seed the local db
        await seedYarnSecuritySettings(localResult.db);
        await localResult.db
            .insert(projects)
            .values({
                id: "p1",
                name: "test",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        const localApp = Fastify();
        localApp.addHook("onRequest", createAuthHook(localContainer));
        await localApp.register(packageManagerRoutes, { container: localContainer });
        await localApp.ready();

        const { token: localToken } = await createTestSession({ db: localResult.db });

        const response = await localApp.inject({
            headers: { authorization: `Bearer ${localToken}` },
            method: "POST",
            url: "/api/projects/p1/package-manager/update",
            payload: { version: "4.20.0" }
        });

        expect(response.statusCode).toBe(403);
        const body = response.json() as { error: { message: string } };
        expect(body.error.message).toBe("Security check failed");

        await localApp.close();
    });
});
