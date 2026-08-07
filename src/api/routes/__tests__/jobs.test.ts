import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import { DirectoryToolFeature, FileToolFeature, JsonFileToolFeature } from "@webiny/stdlib/node";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import {
    seedYarnSecuritySettings,
    VALID_YARNRC
} from "#testing/helpers/seedYarnSecuritySettings.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { SecurityService as SecurityServiceReg } from "../../services/Security/SecurityService.js";
import { UpgradeService as UpgradeServiceReg } from "../../services/Upgrade/UpgradeService.js";
import { PackageManagerService as PackageManagerServiceReg } from "../../services/PackageManagerService.js";
import { AuditParserService as AuditParserServiceReg } from "../../services/AuditParserService.js";
import { OsvCacheService as OsvCacheServiceReg } from "../../services/OsvCacheService.js";
import { VulnerabilityService as VulnerabilityServiceReg } from "../../services/VulnerabilityService.js";
import { LicenseCheckerService as LicenseCheckerServiceReg } from "../../services/LicenseCheckerService.js";
import { LicensePolicyService as LicensePolicyServiceReg } from "../../services/LicensePolicyService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../services/packageManagers/PackageManagerDriverRegistry.js";
import { ScanService as ScanServiceReg } from "../../services/Scan/ScanService.js";
import { RegistryCacheService as RegistryCacheServiceReg } from "../../services/RegistryCache/RegistryCacheService.js";
import { WebSocketBroadcaster as WebSocketBroadcasterReg } from "#api/websocket/WebSocketBroadcaster.js";
import { JobWorker as JobWorkerReg } from "../../services/JobWorker.js";
import { JobWorker } from "../../services/abstractions/JobWorker.js";
import { JobWorkerProvider } from "../../services/abstractions/JobWorkerProvider.js";
import { JobExecutorRegistry as JobExecutorRegistryReg } from "../../services/jobExecutors/JobExecutorRegistry.js";
import { LockfileParserService as LockfileParserServiceReg } from "../../services/LockfileParserService.js";
import { DependencyGraphService as DependencyGraphServiceReg } from "../../services/DependencyGraphService.js";
import { DependencyChangeService as DependencyChangeServiceReg } from "../../services/DependencyChange/DependencyChangeService.js";
import { FileConfigService as FileConfigServiceReg } from "../../services/FileConfig/FileConfigService.js";
import { ErrorReporter } from "../../services/ErrorReporter/index.js";
import { ScanSchedulerService } from "../../services/ScanScheduler/index.js";
import { EventBus } from "../../services/EventBus/EventBus.js";
import { GitService as GitServiceReg } from "../../services/Git/GitService.js";
import { registerEncryption } from "#testing/helpers/registerEncryption.js";
import { ForgeService as ForgeServiceReg } from "../../services/Git/ForgeService.js";
import { AutoFixSettingsService as AutoFixSettingsServiceReg } from "../../services/AutoFix/AutoFixSettingsService.js";
import { AutoFixPrService as AutoFixPrServiceReg } from "../../services/AutoFix/AutoFixPrService.js";
import { GitHubReleasesResolver } from "../../services/changelogResolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "../../services/changelogResolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "../../services/changelogResolvers/NpmReadmeResolver.js";
import { ChangelogJobExecutor as ChangelogJobExecutorReg } from "../../services/jobExecutors/ChangelogJobExecutor.js";
import { DependencyJobExecutor as DependencyJobExecutorReg } from "../../services/jobExecutors/DependencyJobExecutor.js";
import { TransientJobExecutor as TransientJobExecutorReg } from "../../services/jobExecutors/TransientJobExecutor.js";
import { PackageManagerJobExecutor as PackageManagerJobExecutorReg } from "../../services/jobExecutors/PackageManagerJobExecutor.js";
import { InstallJobExecutor as InstallJobExecutorReg } from "../../services/jobExecutors/InstallJobExecutor.js";
import { CloneJobExecutor as CloneJobExecutorReg } from "../../services/jobExecutors/CloneJobExecutor.js";
import { AutoFixPrJobExecutor as AutoFixPrJobExecutorReg } from "../../services/jobExecutors/AutoFixPrJobExecutor.js";
import { ScanJobExecutor as ScanJobExecutorReg } from "../../services/jobExecutors/ScanJobExecutor.js";
import { TransitiveResolveJobExecutor as TransitiveResolveJobExecutorReg } from "../../services/jobExecutors/TransitiveResolveJobExecutor.js";
import { PackageScanJobExecutor as PackageScanJobExecutorReg } from "../../services/jobExecutors/PackageScanJobExecutor.js";
import { VulnerabilityScanJobExecutor as VulnerabilityScanJobExecutorReg } from "../../services/jobExecutors/VulnerabilityScanJobExecutor.js";
import { LicenseScanJobExecutor as LicenseScanJobExecutorReg } from "../../services/jobExecutors/LicenseScanJobExecutor.js";
import { GraphRefreshJobExecutor as GraphRefreshJobExecutorReg } from "../../services/jobExecutors/GraphRefreshJobExecutor.js";
import { jobRoutes } from "../jobs.js";
import { projects, scanResults } from "#api/db/schema.js";

describe("job routes", () => {
    let app: FastifyInstance;
    let testDir: string;
    let db: BetterSQLite3Database;
    let jobWorker: JobWorker.Interface;
    let token: string;

    beforeEach(async () => {
        testDir = join(
            tmpdir(),
            `job-route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "my-test-project" }));
        writeFileSync(join(testDir, ".yarnrc.yml"), VALID_YARNRC);

        db = await createTestDb();
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

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(CommandRunner, {
            run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        });
        container.register(SecurityServiceReg).inSingletonScope();
        container.register(UpgradeServiceReg).inSingletonScope();
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.register(AuditParserServiceReg).inSingletonScope();
        container.register(PackageManagerServiceReg).inSingletonScope();
        container.register(OsvCacheServiceReg).inSingletonScope();
        container.register(VulnerabilityServiceReg).inSingletonScope();
        container.register(LicenseCheckerServiceReg).inSingletonScope();
        container.register(LicensePolicyServiceReg).inSingletonScope();
        container.register(ScanServiceReg).inSingletonScope();
        container.register(RegistryCacheServiceReg).inSingletonScope();
        container.register(WebSocketBroadcasterReg).inSingletonScope();
        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);
        container.register(FileConfigServiceReg).inSingletonScope();
        container.register(GitServiceReg).inSingletonScope();
        registerEncryption(container);
        container.register(ForgeServiceReg).inSingletonScope();
        container.register(AutoFixSettingsServiceReg).inSingletonScope();
        container.register(AutoFixPrServiceReg).inSingletonScope();
        container.register(LockfileParserServiceReg).inSingletonScope();
        container.register(DependencyGraphServiceReg).inSingletonScope();
        container.register(DependencyChangeServiceReg).inSingletonScope();
        container.register(GitHubReleasesResolver);
        container.register(ChangelogFileResolver);
        container.register(NpmReadmeResolver);
        container.register(DependencyJobExecutorReg);
        container.register(TransientJobExecutorReg);
        container.register(PackageManagerJobExecutorReg);
        container.register(InstallJobExecutorReg);
        container.register(CloneJobExecutorReg);
        container.register(AutoFixPrJobExecutorReg);
        container.register(ScanJobExecutorReg);
        container.register(ChangelogJobExecutorReg);
        container.register(TransitiveResolveJobExecutorReg);
        container.register(PackageScanJobExecutorReg);
        container.register(VulnerabilityScanJobExecutorReg);
        container.register(LicenseScanJobExecutorReg);
        container.register(GraphRefreshJobExecutorReg);
        container.register(JobExecutorRegistryReg).inSingletonScope();
        container.register(JobWorkerReg).inSingletonScope();
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

        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        jobWorker = container.resolve(JobWorker);

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(jobRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
        rmSync(testDir, { recursive: true, force: true });
    });

    it("POST /api/projects/:id/jobs/upgrade maps targetVersion to `to` and looks up `from` from scan results", async () => {
        await db
            .insert(scanResults)
            .values({
                id: "sr1",
                projectId: "p1",
                name: "react",
                currentVersion: "18.0.0",
                latestInRange: "18.5.0",
                latestVersion: "19.0.0",
                type: "dependency",
                upgradeType: "minor",
                scannedAt: Date.now()
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/upgrade",
            payload: { packages: [{ name: "react", targetVersion: "19.0.0" }] }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { jobId: string } };
        expect(body.item.jobId).toBeDefined();

        const job = await fetchJobViaApi(app, body.item.jobId, token);
        expect(job.packages).toContain('"from":"18.0.0"');
        expect(job.packages).toContain('"to":"19.0.0"');
    });

    it("looks up `from` as unknown when package is not in the scan results", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/upgrade",
            payload: { packages: [{ name: "left-pad", targetVersion: "2.0.0" }] }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { jobId: string } };

        const job = await fetchJobViaApi(app, body.item.jobId, token);
        expect(job.packages).toContain('"from":"unknown"');
    });

    it("refreshTransient: true chains a transient job after the dependency job completes", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/upgrade",
            payload: {
                packages: [{ name: "react", targetVersion: "19.0.0" }],
                refreshTransient: true
            }
        });

        expect(response.statusCode).toBe(200);

        await jobWorker.processNextJob();
        await jobWorker.drain();

        const historyResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/jobs"
        });
        const body = historyResponse.json() as {
            items: Array<{ type: string; status: string }>;
            total: number;
        };
        expect(body.items).toHaveLength(3);
        expect(body.total).toBe(3);
        expect(body.items.some(job => job.type === "transient")).toBe(true);
        expect(body.items.some(job => job.type === "scan")).toBe(true);
    });

    it("returns 403 when the security check fails", async () => {
        writeFileSync(join(testDir, ".yarnrc.yml"), "enableScripts: true\n");

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/upgrade",
            payload: { packages: [{ name: "react", targetVersion: "19.0.0" }] }
        });

        expect(response.statusCode).toBe(403);
    });

    it("returns 404 when the project does not exist", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/unknown/jobs/upgrade",
            payload: { packages: [{ name: "react", targetVersion: "19.0.0" }] }
        });

        expect(response.statusCode).toBe(404);
    });

    it("POST /api/projects/:id/jobs/transient enqueues a transient job", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/transient"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { jobId: string } };
        const job = await fetchJobViaApi(app, body.item.jobId, token);
        expect(job.type).toBe("transient");
    });

    it("GET /api/projects/:id/jobs/:jobId returns job status and logs", async () => {
        const postResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/upgrade",
            payload: { packages: [{ name: "react", targetVersion: "19.0.0" }] }
        });
        const { item } = postResponse.json() as { item: { jobId: string } };

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/p1/jobs/${item.jobId}`
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { item: { id: string; status: string } };
        expect(body.item.id).toBe(item.jobId);
        expect(body.item.status).toBe("pending");
    });

    it("GET /api/projects/:id/jobs/:jobId returns 404 for unknown job", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/jobs/unknown-job"
        });

        expect(response.statusCode).toBe(404);
    });

    it("GET /api/projects/:id/jobs returns job history for the project", async () => {
        await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/upgrade",
            payload: { packages: [{ name: "react", targetVersion: "19.0.0" }] }
        });
        await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/projects/p1/jobs/transient"
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/projects/p1/jobs"
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { items: unknown[]; total: number };
        expect(body.items).toHaveLength(2);
        expect(body.total).toBe(2);
    });

    describe("GET /api/jobs", () => {
        it("returns all jobs across all projects", async () => {
            await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/projects/p1/jobs/transient"
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/jobs"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json() as { items: unknown[]; total: number };
            expect(body.items.length).toBeGreaterThan(0);
            expect(body.total).toBe(body.items.length);
        });

        it("filters jobs by status query parameter", async () => {
            await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/projects/p1/jobs/transient"
            });
            await jobWorker.processNextJob();
            await jobWorker.drain();

            await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/projects/p1/jobs/transient"
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/jobs?status=pending"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json() as {
                items: Array<{ status: string }>;
                total: number;
            };
            expect(body.items.length).toBeGreaterThan(0);
            expect(body.items.every(job => job.status === "pending")).toBe(true);
        });
    });

    describe("POST /api/jobs/:jobId/cancel", () => {
        it("cancels a pending job and returns 200", async () => {
            const jobId = await jobWorker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: `/api/jobs/${jobId}/cancel`
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ success: true });
            expect((await jobWorker.getJob(jobId))!.status).toBe("cancelled");
        });

        it("returns 404 for an unknown jobId", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/jobs/nonexistent/cancel"
            });

            expect(response.statusCode).toBe(404);
        });

        it("is a no-op for an already-completed job (returns 200, status stays completed)", async () => {
            const jobId = await jobWorker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "transient"
            });

            await jobWorker.processNextJob();
            await jobWorker.drain();

            expect((await jobWorker.getJob(jobId))!.status).toBe("completed");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: `/api/jobs/${jobId}/cancel`
            });

            expect(response.statusCode).toBe(200);
            expect((await jobWorker.getJob(jobId))!.status).toBe("completed");
        });

        it("cancels a running job via AbortController", async () => {
            // The beforeEach mock resolves instantly, so a job would complete
            // before we get a chance to cancel it. Build a separate container
            // with a CommandRunner mock that blocks until the signal aborts.
            const slowContainer = createContainer();
            const slowDb = await createTestDb();
            await seedYarnSecuritySettings(slowDb);
            await slowDb
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test",
                    path: testDir,
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            slowContainer.registerInstance(DatabaseClient, { db: slowDb });
            slowContainer.registerInstance(CommandRunner, {
                run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
                runStreaming: vi.fn(async (_cmd, _args, options) => {
                    return new Promise<{
                        stdout: string;
                        stderr: string;
                        exitCode: number;
                    }>((_resolve, reject) => {
                        if (options?.signal) {
                            if (options.signal.aborted) {
                                reject(new Error("aborted"));
                                return;
                            }
                            options.signal.addEventListener("abort", () => {
                                reject(new Error("aborted"));
                            });
                        }
                    });
                })
            });
            slowContainer.register(SecurityServiceReg).inSingletonScope();
            slowContainer.register(UpgradeServiceReg).inSingletonScope();
            slowContainer.register(PackageManagerDriverRegistryReg).inSingletonScope();
            slowContainer.register(AuditParserServiceReg).inSingletonScope();
            slowContainer.register(PackageManagerServiceReg).inSingletonScope();
            slowContainer.register(OsvCacheServiceReg).inSingletonScope();
            slowContainer.register(VulnerabilityServiceReg).inSingletonScope();
            slowContainer.register(LicenseCheckerServiceReg).inSingletonScope();
            slowContainer.register(LicensePolicyServiceReg).inSingletonScope();
            slowContainer.register(ScanServiceReg).inSingletonScope();
            slowContainer.register(RegistryCacheServiceReg).inSingletonScope();
            slowContainer.register(WebSocketBroadcasterReg).inSingletonScope();
            slowContainer.registerInstance(ConsoleLoggerConfig, {
                getConfig: () => ({ logLevel: "error" })
            });
            ConsoleLoggerFeature.register(slowContainer);
            DirectoryToolFeature.register(slowContainer);
            FileToolFeature.register(slowContainer);
            JsonFileToolFeature.register(slowContainer);
            slowContainer.register(FileConfigServiceReg).inSingletonScope();
            slowContainer.register(GitServiceReg).inSingletonScope();
            registerEncryption(slowContainer);
            slowContainer.register(ForgeServiceReg).inSingletonScope();
            slowContainer.register(AutoFixSettingsServiceReg).inSingletonScope();
            slowContainer.register(AutoFixPrServiceReg).inSingletonScope();
            slowContainer.register(LockfileParserServiceReg).inSingletonScope();
            slowContainer.register(DependencyGraphServiceReg).inSingletonScope();
            slowContainer.register(DependencyChangeServiceReg).inSingletonScope();
            slowContainer.register(GitHubReleasesResolver);
            slowContainer.register(ChangelogFileResolver);
            slowContainer.register(NpmReadmeResolver);
            slowContainer.register(DependencyJobExecutorReg);
            slowContainer.register(TransientJobExecutorReg);
            slowContainer.register(PackageManagerJobExecutorReg);
            slowContainer.register(InstallJobExecutorReg);
            slowContainer.register(CloneJobExecutorReg);
            slowContainer.register(AutoFixPrJobExecutorReg);
            slowContainer.register(ScanJobExecutorReg);
            slowContainer.register(ChangelogJobExecutorReg);
            slowContainer.register(TransitiveResolveJobExecutorReg);
            slowContainer.register(PackageScanJobExecutorReg);
            slowContainer.register(VulnerabilityScanJobExecutorReg);
            slowContainer.register(LicenseScanJobExecutorReg);
            slowContainer.register(GraphRefreshJobExecutorReg);
            slowContainer.register(JobExecutorRegistryReg).inSingletonScope();
            slowContainer.register(JobWorkerReg).inSingletonScope();
            slowContainer.registerFactory(JobWorkerProvider, () => ({
                get: () => slowContainer.resolve(JobWorker)
            }));
            slowContainer.registerInstance(ErrorReporter, {
                reportJobFailure: vi.fn(),
                reportJobWarning: vi.fn(),
                reportStepFailure: vi.fn()
            });
            slowContainer.register(EventBus).inSingletonScope();
            slowContainer.registerInstance(ScanSchedulerService, {
                init: vi.fn(),
                stop: vi.fn(),
                scheduleProject: vi.fn(),
                unscheduleProject: vi.fn(),
                onGlobalDefaultChanged: vi.fn(),
                onScanComplete: vi.fn()
            });

            slowContainer.registerInstance(EmailService, { send: vi.fn() });
            slowContainer.register(UserServiceRegistration).inSingletonScope();
            slowContainer.register(AuthServiceRegistration).inSingletonScope();

            const slowWorker = slowContainer.resolve(JobWorker);

            const slowApp = Fastify();
            slowApp.addHook("onRequest", createAuthHook(slowContainer));
            await slowApp.register(jobRoutes, { container: slowContainer });
            await slowApp.ready();

            const { token: slowToken } = await createTestSession({ db: slowDb });

            const jobId = await slowWorker.enqueue({
                referenceId: "p1",
                referenceType: "project",
                type: "transient"
            });

            await slowWorker.processNextJob();
            await new Promise(resolve => setTimeout(resolve, 0));

            const response = await slowApp.inject({
                headers: { authorization: `Bearer ${slowToken}` },
                method: "POST",
                url: `/api/jobs/${jobId}/cancel`
            });

            expect(response.statusCode).toBe(200);

            await slowWorker.drain();

            const job = await slowWorker.getJob(jobId);
            expect(job!.status).toBe("cancelled");

            await slowApp.close();
        });
    });
});

async function fetchJobViaApi(
    app: FastifyInstance,
    jobId: string,
    token: string
): Promise<{ packages: string | null; type: string }> {
    const response = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: "GET",
        url: `/api/projects/p1/jobs/${jobId}`
    });
    const body = response.json() as {
        item: { packages: string | null; type: string };
    };
    return body.item;
}
