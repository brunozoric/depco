import { vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { ErrorReporter } from "../../services/ErrorReporter/index.js";
import { ScanSchedulerService } from "../../services/ScanScheduler/index.js";
import { EmailService } from "../../services/Email/index.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { projectRoutes } from "../projects.js";

export const VALID_YARNRC = [
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
export async function driveJobToCompletion(
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

export interface ScanSchedulerServiceMock {
    init: ReturnType<typeof vi.fn<() => Promise<void>>>;
    stop: ReturnType<typeof vi.fn<() => Promise<void>>>;
    scheduleProject: ReturnType<typeof vi.fn<(projectId: string) => Promise<void>>>;
    unscheduleProject: ReturnType<typeof vi.fn<(projectId: string) => Promise<void>>>;
    onGlobalDefaultChanged: ReturnType<typeof vi.fn<() => Promise<void>>>;
    onScanComplete: ReturnType<typeof vi.fn<(projectId: string) => Promise<void>>>;
}

export interface ProjectsTestContext {
    app: FastifyInstance;
    testDir: string;
    db: ReturnType<typeof createTestApiContainer>["db"];
    jobWorker: JobWorker.Interface;
    scanSchedulerMock: ScanSchedulerServiceMock;
    token: string;
}

export async function setupProjectsTest(): Promise<ProjectsTestContext> {
    const testDir = join(
        tmpdir(),
        `route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "my-test-project" }));
    writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);
    writeFileSync(join(testDir, "yarn.lock"), "");

    const result = createTestApiContainer();
    const db = result.db;
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
    const scanSchedulerMock: ScanSchedulerServiceMock = {
        init: vi.fn(),
        stop: vi.fn(),
        scheduleProject: vi.fn(),
        unscheduleProject: vi.fn(),
        onGlobalDefaultChanged: vi.fn(),
        onScanComplete: vi.fn()
    };
    container.registerInstance(ScanSchedulerService, scanSchedulerMock);
    container.registerInstance(EmailService, { send: vi.fn() });

    const jobWorker = container.resolve(JobWorker);

    const app = Fastify();
    app.addHook("onRequest", createAuthHook(container));
    await app.register(projectRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db });

    return { app, testDir, db, jobWorker, scanSchedulerMock, token };
}

export async function teardownProjectsTest(context: ProjectsTestContext): Promise<void> {
    await context.app.close();
    rmSync(context.testDir, { recursive: true, force: true });
}
