import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { eq } from "drizzle-orm";
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import { DirectoryToolFeature, FileToolFeature, JsonFileToolFeature } from "@webiny/stdlib/node";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import {
    seedYarnSecuritySettings,
    VALID_YARNRC
} from "#testing/helpers/seedYarnSecuritySettings.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, upgradeJobs } from "#api/db/schema.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { SecurityService as SecurityServiceRegistration } from "../../Security/SecurityService.js";
import { UpgradeService as UpgradeServiceRegistration } from "../../Upgrade/UpgradeService.js";
import { PackageManagerService as PackageManagerServiceRegistration } from "../../PackageManager/PackageManagerService.js";
import { AuditParserService as AuditParserServiceRegistration } from "../../Vulnerability/AuditParserService.js";
import { OsvCacheService as OsvCacheServiceRegistration } from "../../Vulnerability/OsvCacheService.js";
import { VulnerabilityService as VulnerabilityServiceRegistration } from "../../Vulnerability/VulnerabilityService.js";
import { LicenseCheckerService as LicenseCheckerServiceRegistration } from "../../License/LicenseCheckerService.js";
import { LicensePolicyService as LicensePolicyServiceRegistration } from "../../License/LicensePolicyService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryRegistration } from "../../PackageManager/PackageManagerDriverRegistry.js";
import { ScanService as ScanServiceRegistration } from "../../Scan/ScanService.js";
import { RegistryCacheService as RegistryCacheServiceRegistration } from "../../RegistryCache/RegistryCacheService.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { WebSocketBroadcaster as WebSocketBroadcasterRegistration } from "#api/websocket/WebSocketBroadcaster.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import { JobWorker as JobWorkerRegistration } from "../JobWorker.js";
import { JobWorkerProvider } from "../abstractions/JobWorkerProvider.js";
import { JobExecutorRegistry as JobExecutorRegistryRegistration } from "../executors/JobExecutorRegistry.js";
import { LockfileParserService } from "../../DependencyGraph/index.js";
import { DependencyGraphService as DependencyGraphServiceRegistration } from "../../DependencyGraph/DependencyGraphService.js";
import { DependencyChangeService as DependencyChangeServiceRegistration } from "../../DependencyChange/DependencyChangeService.js";
import { FileConfigService as FileConfigServiceRegistration } from "../../FileConfig/FileConfigService.js";
import { ErrorReporter } from "../../ErrorReporter/index.js";
import { ScanSchedulerService } from "../../ScanScheduler/index.js";
import { EventBus } from "../../EventBus/EventBus.js";
import { GitService as GitServiceRegistration } from "../../Git/GitService.js";
import { registerEncryption } from "#testing/helpers/registerEncryption.js";
import { ForgeService as ForgeServiceRegistration } from "../../Git/ForgeService.js";
import { AutoFixSettingsService as AutoFixSettingsServiceRegistration } from "../../AutoFix/AutoFixSettingsService.js";
import { AutoFixPrService as AutoFixPrServiceRegistration } from "../../AutoFix/AutoFixPrService.js";
import { GitHubReleasesResolver } from "../../Changelog/resolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "../../Changelog/resolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "../../Changelog/resolvers/NpmReadmeResolver.js";
import { ChangelogJobExecutor as ChangelogJobExecutorRegistration } from "../executors/ChangelogJobExecutor.js";
import { DependencyJobExecutor as DependencyJobExecutorRegistration } from "../executors/DependencyJobExecutor.js";
import { TransientJobExecutor as TransientJobExecutorRegistration } from "../executors/TransientJobExecutor.js";
import { PackageManagerJobExecutor as PackageManagerJobExecutorRegistration } from "../executors/PackageManagerJobExecutor.js";
import { InstallJobExecutor as InstallJobExecutorRegistration } from "../executors/InstallJobExecutor.js";
import { CloneJobExecutor as CloneJobExecutorRegistration } from "../executors/CloneJobExecutor.js";
import { AutoFixPrJobExecutor as AutoFixPrJobExecutorRegistration } from "../executors/AutoFixPrJobExecutor.js";
import { ScanJobExecutor as ScanJobExecutorRegistration } from "../executors/ScanJobExecutor.js";
import { TransitiveResolveJobExecutor as TransitiveResolveJobExecutorRegistration } from "../executors/TransitiveResolveJobExecutor.js";
import { PackageScanJobExecutor as PackageScanJobExecutorRegistration } from "../executors/PackageScanJobExecutor.js";
import { VulnerabilityScanJobExecutor as VulnerabilityScanJobExecutorRegistration } from "../executors/VulnerabilityScanJobExecutor.js";
import { LicenseScanJobExecutor as LicenseScanJobExecutorRegistration } from "../executors/LicenseScanJobExecutor.js";
import { GraphRefreshJobExecutor as GraphRefreshJobExecutorRegistration } from "../executors/GraphRefreshJobExecutor.js";

function createMockCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
        runStreaming: vi.fn(async (_command, _args, options) => {
            options.onStdout("Processing...");
            return { stdout: "", stderr: "", exitCode: 0 };
        })
    };
}

// CommandRunner double that can also drive a scan: resolves workspace
// listing, installed-version collection, and registry lookups so
// ScanService produces a real (non-empty) result set.
function createScanCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async (_command: string, args: string[]) => {
            if (args[0] === "workspaces") {
                return { stdout: '{"location":"."}\n', stderr: "", exitCode: 0 };
            }
            if (args[0] === "info" && args[1] === "--all") {
                return {
                    stdout: '{"value":"left-pad@npm:1.3.0","children":{"Version":"1.3.0"}}\n',
                    stderr: "",
                    exitCode: 0
                };
            }
            if (args[0] === "npm" && args[1] === "info") {
                return {
                    stdout: JSON.stringify({
                        "dist-tags": { latest: "1.4.0" },
                        versions: ["1.3.0", "1.4.0"],
                        time: {
                            "1.3.0": "2020-01-01T00:00:00.000Z",
                            "1.4.0": "2020-06-01T00:00:00.000Z"
                        },
                        repository: {
                            type: "git",
                            url: "git+https://github.com/left-pad/left-pad.git"
                        },
                        readme: "# left-pad"
                    }),
                    stderr: "",
                    exitCode: 0
                };
            }
            return { stdout: "", stderr: "", exitCode: 0 };
        }),
        runStreaming: vi.fn(async (_command, _args, options) => {
            options.onStdout("Processing...");
            return { stdout: "", stderr: "", exitCode: 0 };
        })
    };
}

async function createProject(
    db: Awaited<ReturnType<typeof createTestDb>>,
    id: string,
    path: string
): Promise<void> {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, ".yarnrc.yml"), VALID_YARNRC);
    await db
        .insert(projects)
        .values({ id, name: id, path, packageManager: "yarn", addedAt: Date.now() })
        .run();
}

describe("JobWorker", () => {
    let testDir: string;
    let worker: JobWorker.Interface;
    let commandRunner: CommandRunner.Interface;
    let broadcaster: WebSocketBroadcaster.Interface;
    let db: Awaited<ReturnType<typeof createTestDb>>;

    beforeEach(async () => {
        testDir = join(tmpdir(), `worker-test-${Date.now()}-${Math.random()}`);
        db = await createTestDb();

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        commandRunner = createMockCommandRunner();
        container.registerInstance(CommandRunner, commandRunner);
        container.register(SecurityServiceRegistration).inSingletonScope();
        container.register(UpgradeServiceRegistration).inSingletonScope();
        container.register(PackageManagerDriverRegistryRegistration).inSingletonScope();
        container.register(AuditParserServiceRegistration).inSingletonScope();
        container.register(PackageManagerServiceRegistration).inSingletonScope();
        container.register(OsvCacheServiceRegistration).inSingletonScope();
        container.register(VulnerabilityServiceRegistration).inSingletonScope();
        container.register(LicenseCheckerServiceRegistration).inSingletonScope();
        container.register(LicensePolicyServiceRegistration).inSingletonScope();
        container.register(ScanServiceRegistration).inSingletonScope();
        container.register(RegistryCacheServiceRegistration).inSingletonScope();
        container.register(WebSocketBroadcasterRegistration).inSingletonScope();
        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);
        container.register(FileConfigServiceRegistration).inSingletonScope();
        container.register(GitServiceRegistration).inSingletonScope();
        registerEncryption(container);
        container.register(ForgeServiceRegistration).inSingletonScope();
        container.register(AutoFixSettingsServiceRegistration).inSingletonScope();
        container.register(AutoFixPrServiceRegistration).inSingletonScope();
        container.registerInstance(LockfileParserService, {
            parse: vi.fn(async () => [
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "left-pad",
                    childVersion: "1.3.0",
                    dependencyType: "dependency",
                    depth: 0
                }
            ])
        });
        container.register(DependencyGraphServiceRegistration).inSingletonScope();
        container.register(DependencyChangeServiceRegistration).inSingletonScope();
        container.register(GitHubReleasesResolver);
        container.register(ChangelogFileResolver);
        container.register(NpmReadmeResolver);
        container.register(DependencyJobExecutorRegistration);
        container.register(TransientJobExecutorRegistration);
        container.register(PackageManagerJobExecutorRegistration);
        container.register(InstallJobExecutorRegistration);
        container.register(CloneJobExecutorRegistration);
        container.register(AutoFixPrJobExecutorRegistration);
        container.register(ScanJobExecutorRegistration);
        container.register(ChangelogJobExecutorRegistration);
        container.register(TransitiveResolveJobExecutorRegistration);
        container.register(PackageScanJobExecutorRegistration);
        container.register(VulnerabilityScanJobExecutorRegistration);
        container.register(LicenseScanJobExecutorRegistration);
        container.register(GraphRefreshJobExecutorRegistration);
        container.register(JobExecutorRegistryRegistration).inSingletonScope();
        container.register(JobWorkerRegistration).inSingletonScope();
        container.registerFactory(JobWorkerProvider, () => ({
            get: () => container.resolve(JobWorker)
        }));
        container.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        container.register(EventBus).inSingletonScope();
        container.registerInstance(ScanSchedulerService, {
            init: vi.fn(),
            stop: vi.fn(),
            scheduleProject: vi.fn(),
            unscheduleProject: vi.fn(),
            onGlobalDefaultChanged: vi.fn(),
            onScanComplete: vi.fn()
        });

        await seedYarnSecuritySettings(db);
        await createProject(db, "p1", join(testDir, "p1"));

        worker = container.resolve(JobWorker);
        broadcaster = container.resolve(WebSocketBroadcaster);
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    it("enqueues a dependency upgrade job as pending", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        const job = await worker.getJob(jobId);
        expect(job).toBeDefined();
        expect(job!.status).toBe("pending");
        expect(job!.type).toBe("dependency");
    });

    it("rejects a dependency job when the security check fails", async () => {
        writeFileSync(join(testDir, "p1", ".yarnrc.yml"), "enableScripts: true\n");

        await expect(
            worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
            })
        ).rejects.toThrow("Security check failed");
    });

    it("rejects a transient job when the security check fails", async () => {
        writeFileSync(join(testDir, "p1", ".yarnrc.yml"), "enableScripts: true\n");

        await expect(
            worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "transient"
            })
        ).rejects.toThrow("Security check failed");
    });

    it("allows a packageManager job without a security check", async () => {
        writeFileSync(join(testDir, "p1", ".yarnrc.yml"), "enableScripts: true\n");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "packageManager",
            packages: { from: "4.0.0", to: "4.7.0" }
        });

        expect(jobId).toBeDefined();
    });

    it("throws when enqueuing for a project that does not exist", async () => {
        await expect(
            worker.enqueue({
                referenceId: "does-not-exist",
                referenceType: "project",
                type: "dependency",
                packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
            })
        ).rejects.toThrow("Project not found");
    });

    it("retrieves jobs for a project", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        const jobs = await worker.getJobsForReference("p1");
        expect(jobs).toHaveLength(1);
    });

    it("returns null for a job that does not exist", async () => {
        const job = await worker.getJob("does-not-exist");
        expect(job).toBeNull();
    });

    it("processes a pending dependency job to completion, invoking upgradeService per package", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [
                { name: "react", from: "18.0.0", to: "19.0.0" },
                { name: "react-dom", from: "18.0.0", to: "19.0.0" }
            ]
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
        expect(job!.startedAt).not.toBeNull();
        expect(job!.completedAt).not.toBeNull();
        expect(job!.logs).toContain("Processing...");
        expect(commandRunner.runStreaming).toHaveBeenCalledTimes(2);
    });

    it("processes a transient job via refreshTransient", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transient"
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "yarn",
            ["up", "**", "-R"],
            expect.anything()
        );
    });

    it("processes a packageManager job via updateVersion", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "packageManager",
            packages: { from: "4.0.0", to: "4.7.0" }
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("completed");
        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "yarn",
            ["set", "version", "4.7.0"],
            expect.anything()
        );
    });

    it("marks a job as failed when execution throws", async () => {
        commandRunner.runStreaming = vi.fn(async () => {
            throw new Error("boom");
        });

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("failed");
        expect(job!.logs).toContain("ERROR");
        expect(job!.logs).toContain("boom");
    });

    it("runs two jobs for the same project concurrently (no per-project serialization)", async () => {
        const firstJobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        const secondJobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react-dom", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();

        const first = await worker.getJob(firstJobId);
        const second = await worker.getJob(secondJobId);
        expect(first!.status).toBe("running");
        expect(second!.status).toBe("running");

        await worker.drain();

        expect((await worker.getJob(firstJobId))!.status).toBe("completed");
        expect((await worker.getJob(secondJobId))!.status).toBe("completed");
    });

    it("runs jobs for different projects concurrently", async () => {
        await createProject(db, "p2", join(testDir, "p2"));

        const jobOneId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        const jobTwoId = await worker.enqueue({
            referenceId: "p2",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react-dom", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();

        const jobOne = await worker.getJob(jobOneId);
        const jobTwo = await worker.getJob(jobTwoId);
        expect(jobOne!.status).toBe("running");
        expect(jobTwo!.status).toBe("running");

        await worker.drain();

        expect((await worker.getJob(jobOneId))!.status).toBe("completed");
        expect((await worker.getJob(jobTwoId))!.status).toBe("completed");
    });

    it("chains an auto-enqueued transient job after a dependency job with refreshTransient completes", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }],
            refreshTransient: true
        });

        await worker.processNextJob();
        await worker.drain();

        expect((await worker.getJob(jobId))!.status).toBe("completed");

        const jobsAfterDep = await worker.getJobsForReference("p1");
        const transientJob = jobsAfterDep.find(job => job.type === "transient");
        expect(transientJob).toBeDefined();
        expect(transientJob!.status).toBe("pending");
        expect(jobsAfterDep.filter(job => job.type === "scan")).toHaveLength(1);

        await worker.processNextJob();
        await worker.drain();

        expect((await worker.getJob(transientJob!.id))!.status).toBe("completed");
    });

    it("does not chain a transient job when refreshTransient is not set, but chains a scan", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        expect(jobs).toHaveLength(2);
        expect(jobs.find(job => job.type === "transient")).toBeUndefined();
        expect(jobs.find(job => job.type === "scan")).toBeDefined();
    });

    it("chains an auto-scan after a dependency job completes", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        const scanJob = jobs.find(job => job.type === "scan");
        expect(scanJob).toBeDefined();
        expect(scanJob!.status).toBe("pending");
    });

    it("chains an auto-scan after a transient job completes", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transient"
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        const scanJob = jobs.find(job => job.type === "scan");
        expect(scanJob).toBeDefined();
        expect(scanJob!.status).toBe("pending");
    });

    it("does not chain a transient job when refreshTransient is set on a non-dependency job", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "packageManager",
            packages: { from: "4.0.0", to: "4.7.0" },
            refreshTransient: true
        });

        await worker.processNextJob();
        await worker.drain();

        const jobs = await worker.getJobsForReference("p1");
        expect(jobs).toHaveLength(1);
    });

    it("broadcasts job:status transitions for running and completed", async () => {
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();

        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "running"
        });

        await worker.drain();

        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });
    });

    it("broadcasts job:log for each stdout/stderr line during execution", async () => {
        commandRunner.runStreaming = vi.fn(async (_cmd, _args, options) => {
            options?.onStdout?.("line 1");
            options?.onStdout?.("line 2");
            return { stdout: "", stderr: "", exitCode: 0 };
        });
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        const logCalls = broadcastSpy.mock.calls.filter(([type]) => type === "job:log");
        expect(logCalls).toEqual([
            ["job:log", { jobId, referenceId: "p1", line: "line 1" }],
            ["job:log", { jobId, referenceId: "p1", line: "line 2" }],
            [
                "job:log",
                {
                    jobId,
                    referenceId: "p1",
                    line: "Auto-scan enqueued after dependency"
                }
            ]
        ]);
    });

    it("broadcasts job:status failed when a job fails", async () => {
        commandRunner.runStreaming = vi.fn(async () => {
            throw new Error("boom");
        });
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        await worker.drain();

        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "failed"
        });
    });

    it("cancels a pending job without aborting a subprocess", async () => {
        const broadcastSpy = vi.spyOn(broadcaster, "broadcast");
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.cancelJob(jobId);

        const job = await worker.getJob(jobId);
        expect(job!.status).toBe("cancelled");
        expect(job!.completedAt).not.toBeNull();
        expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
            jobId,
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "cancelled"
        });
    });

    it("cancels a running job by aborting the subprocess", async () => {
        let resolveStreaming: (() => void) | undefined;
        commandRunner.runStreaming = vi.fn(
            () =>
                new Promise<CommandRunner.Result>(resolve => {
                    resolveStreaming = () => resolve({ stdout: "", stderr: "", exitCode: 0 });
                })
        );

        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });

        await worker.processNextJob();
        expect((await worker.getJob(jobId))!.status).toBe("running");

        await worker.cancelJob(jobId);
        resolveStreaming!();
        await worker.drain();

        expect((await worker.getJob(jobId))!.status).toBe("cancelled");
    });

    it("is a no-op when cancelling a completed job", async () => {
        const jobId = await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        await worker.processNextJob();
        await worker.drain();

        expect((await worker.getJob(jobId))!.status).toBe("completed");
        await worker.cancelJob(jobId);
        expect((await worker.getJob(jobId))!.status).toBe("completed");
    });

    it("lists all jobs across all projects", async () => {
        await createProject(db, "p2", join(testDir, "p2"));
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        await worker.enqueue({
            referenceId: "p2",
            referenceType: "project",
            type: "transient"
        });

        const all = await worker.listAllJobs();
        expect(all).toHaveLength(2);
    });

    it("lists jobs filtered by status", async () => {
        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
        });
        await worker.processNextJob();
        await worker.drain();

        await worker.enqueue({
            referenceId: "p1",
            referenceType: "project",
            type: "transient"
        });

        const completed = await worker.listAllJobs("completed");
        expect(completed).toHaveLength(1);
        expect(completed[0]!.status).toBe("completed");

        const pending = await worker.listAllJobs("pending");
        expect(pending).toHaveLength(2);
        expect(pending.every(j => j.status === "pending")).toBe(true);
    });

    it("recovers stale running and pending jobs as interrupted on server restart", async () => {
        await db
            .insert(upgradeJobs)
            .values([
                {
                    id: "job-running",
                    referenceId: "p1",
                    referenceType: "project",
                    type: "dependency",
                    status: "running"
                },
                {
                    id: "job-pending",
                    referenceId: "p1",
                    referenceType: "project",
                    type: "dependency",
                    status: "pending"
                }
            ])
            .run();

        await worker.recoverStaleJobs();

        const runningJob = await worker.getJob("job-running");
        const pendingJob = await worker.getJob("job-pending");
        expect(runningJob!.status).toBe("interrupted");
        expect(runningJob!.logs).toBe("Job interrupted by server restart");
        expect(pendingJob!.status).toBe("interrupted");
        expect(pendingJob!.logs).toBe("Job interrupted by server restart");
    });

    describe("waitForJob", () => {
        it("resolves when the job reaches a terminal state", async () => {
            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            setTimeout(() => {
                void db
                    .update(upgradeJobs)
                    .set({ status: "completed", completedAt: Date.now() })
                    .where(eq(upgradeJobs.id, jobId))
                    .run();
            }, 50);

            const result = await worker.waitForJob({ jobId });

            expect(result.status).toBe("completed");
            expect(result.id).toBe(jobId);
        });

        it("throws when the signal is aborted before the job reaches a terminal state", async () => {
            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            const controller = new AbortController();
            setTimeout(() => controller.abort(), 50);

            await expect(worker.waitForJob({ jobId, signal: controller.signal })).rejects.toThrow();
        });

        it("throws when the job does not exist", async () => {
            await expect(worker.waitForJob({ jobId: "does-not-exist" })).rejects.toThrow(
                "Job not found"
            );
        });

        it("resolves immediately when the job is already in a terminal state", async () => {
            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
            });
            await worker.processNextJob();
            await worker.drain();

            const result = await worker.waitForJob({ jobId });
            expect(result.status).toBe("completed");
        });
    });

    describe("waitForJobs", () => {
        it("resolves once all jobs reach a terminal state", async () => {
            const firstJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const secondJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            setTimeout(() => {
                void db
                    .update(upgradeJobs)
                    .set({ status: "completed", completedAt: Date.now() })
                    .where(eq(upgradeJobs.id, firstJobId))
                    .run();
            }, 50);
            setTimeout(() => {
                void db
                    .update(upgradeJobs)
                    .set({ status: "failed", completedAt: Date.now() })
                    .where(eq(upgradeJobs.id, secondJobId))
                    .run();
            }, 100);

            const results = await worker.waitForJobs({ jobIds: [firstJobId, secondJobId] });

            expect(results).toHaveLength(2);
            expect(results.find(job => job.id === firstJobId)?.status).toBe("completed");
            expect(results.find(job => job.id === secondJobId)?.status).toBe("failed");
        });

        it("throws when the signal is aborted before all jobs reach a terminal state", async () => {
            const firstJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const secondJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            const controller = new AbortController();
            setTimeout(() => controller.abort(), 50);

            await expect(
                worker.waitForJobs({
                    jobIds: [firstJobId, secondJobId],
                    signal: controller.signal
                })
            ).rejects.toThrow();
        });
    });

    describe("getRunningJobsForReference", () => {
        it("returns only running jobs matching the referenceId and type", async () => {
            const runningJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const pendingJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });
            const differentTypeJobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "transient"
            });

            await db
                .update(upgradeJobs)
                .set({ status: "running", startedAt: Date.now() })
                .where(eq(upgradeJobs.id, runningJobId))
                .run();
            await db
                .update(upgradeJobs)
                .set({ status: "running", startedAt: Date.now() })
                .where(eq(upgradeJobs.id, differentTypeJobId))
                .run();

            const running = await worker.getRunningJobsForReference({
                referenceId: "p1",
                type: "scan"
            });

            expect(running).toHaveLength(1);
            expect(running[0]?.id).toBe(runningJobId);
            expect(running.some(job => job.id === pendingJobId)).toBe(false);
            expect(running.some(job => job.id === differentTypeJobId)).toBe(false);
        });

        it("returns an empty array when no jobs are running for the reference", async () => {
            await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan"
            });

            const running = await worker.getRunningJobsForReference({
                referenceId: "p1",
                type: "scan"
            });

            expect(running).toHaveLength(0);
        });
    });

    describe("scan jobs", () => {
        beforeEach(() => {
            writeFileSync(
                join(testDir, "p1", "package.json"),
                JSON.stringify({ name: "p1", dependencies: { "left-pad": "^1.0.0" } })
            );
            commandRunner.run = createScanCommandRunner().run;
        });

        // "scan" is now a thin orchestrator (see ScanJobExecutor.ts) that
        // enqueues a "package-scan" child job and waits for it — it no
        // longer scans/persists anything itself. A single processNextJob()
        // + drain() pass can't drive that child job to completion here (only
        // a running server's setInterval polling loop does that), so the
        // "persists results" and "delete-then-insert" scenarios once covered
        // here now live in PackageScanJobExecutor.test.ts against the real
        // executor directly, and the orchestration behavior itself (chaining,
        // concurrency guard, warning composition) is covered in
        // ScanJobExecutor.test.ts against a mocked JobWorker.

        it("broadcasts scan:failed and marks the job failed when ScanService throws", async () => {
            commandRunner.run = vi.fn(async () => {
                throw new Error("registry unreachable");
            });
            const broadcastSpy = vi.spyOn(broadcaster, "broadcast");

            const jobId = await worker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                packages: JSON.stringify({})
            });

            await worker.processNextJob();
            await worker.drain();

            const job = await worker.getJob(jobId);
            expect(job!.status).toBe("failed");
            expect(job!.logs).toContain("ERROR");

            expect(broadcastSpy).toHaveBeenCalledWith(
                "scan:failed",
                expect.objectContaining({ projectId: "p1" })
            );
            expect(broadcastSpy).toHaveBeenCalledWith("job:status", {
                jobId,
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                status: "failed"
            });
        });
    });
});
