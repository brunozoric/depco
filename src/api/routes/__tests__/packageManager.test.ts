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
import { UserService as UserServiceRegistration } from "#api/services/Auth/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/Auth/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { SecurityService as SecurityServiceReg } from "../../services/Security/SecurityService.js";
import { UpgradeService as UpgradeServiceReg } from "../../services/Upgrade/UpgradeService.js";
import { PackageManagerService as PackageManagerServiceReg } from "../../services/PackageManager/PackageManagerService.js";
import { AuditParserService as AuditParserServiceReg } from "../../services/Vulnerability/AuditParserService.js";
import { OsvCacheService as OsvCacheServiceReg } from "../../services/Vulnerability/OsvCacheService.js";
import { AuditParserService as SharedAuditParserServiceRegistration } from "#shared/vulnerabilities/AuditParserService.js";
import { OsvQueryService as SharedOsvQueryServiceRegistration } from "#shared/vulnerabilities/OsvQueryService.js";
import { VulnerabilityMerger as VulnerabilityMergerRegistration } from "#shared/vulnerabilities/VulnerabilityMerger.js";
import { VulnerabilityService as VulnerabilityServiceReg } from "../../services/Vulnerability/VulnerabilityService.js";
import { LicenseCheckerService as LicenseCheckerServiceReg } from "../../services/License/LicenseCheckerService.js";
import { LicensePolicyService as LicensePolicyServiceReg } from "../../services/License/LicensePolicyService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../services/PackageManager/PackageManagerDriverRegistry.js";
import { ScanService as ScanServiceReg } from "../../services/Scan/ScanService.js";
import { RegistryCacheService as RegistryCacheServiceReg } from "../../services/RegistryCache/RegistryCacheService.js";
import { WebSocketBroadcaster as WebSocketBroadcasterReg } from "#api/websocket/WebSocketBroadcaster.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { JobWorker as JobWorkerReg } from "../../services/JobExecution/JobWorker.js";
import { JobWorkerProvider } from "../../services/JobExecution/index.js";
import { JobExecutorRegistry as JobExecutorRegistryReg } from "../../services/JobExecution/executors/JobExecutorRegistry.js";
import { LockfileParserService as LockfileParserServiceReg } from "../../services/DependencyGraph/LockfileParserService.js";
import { DependencyGraphService as DependencyGraphServiceReg } from "../../services/DependencyGraph/DependencyGraphService.js";
import { DependencyChangeService as DependencyChangeServiceReg } from "../../services/DependencyChange/DependencyChangeService.js";
import { FileConfigService as FileConfigServiceReg } from "../../services/FileConfig/FileConfigService.js";
import { GitService as GitServiceReg } from "../../services/Git/GitService.js";
import { registerEncryption } from "#testing/helpers/registerEncryption.js";
import { ForgeService as ForgeServiceReg } from "../../services/Git/ForgeService.js";
import { AutoFixSettingsService as AutoFixSettingsServiceReg } from "../../services/AutoFix/AutoFixSettingsService.js";
import { AutoFixPrService as AutoFixPrServiceReg } from "../../services/AutoFix/AutoFixPrService.js";
import { GitHubReleasesResolver } from "../../services/Changelog/resolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "../../services/Changelog/resolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "../../services/Changelog/resolvers/NpmReadmeResolver.js";
import { ChangelogJobExecutor as ChangelogJobExecutorReg } from "../../services/JobExecution/executors/ChangelogJobExecutor.js";
import { DependencyJobExecutor as DependencyJobExecutorReg } from "../../services/JobExecution/executors/DependencyJobExecutor.js";
import { TransientJobExecutor as TransientJobExecutorReg } from "../../services/JobExecution/executors/TransientJobExecutor.js";
import { PackageManagerJobExecutor as PackageManagerJobExecutorReg } from "../../services/JobExecution/executors/PackageManagerJobExecutor.js";
import { InstallJobExecutor as InstallJobExecutorReg } from "../../services/JobExecution/executors/InstallJobExecutor.js";
import { CloneJobExecutor as CloneJobExecutorReg } from "../../services/JobExecution/executors/CloneJobExecutor.js";
import { AutoFixPrJobExecutor as AutoFixPrJobExecutorReg } from "../../services/JobExecution/executors/AutoFixPrJobExecutor.js";
import { ScanJobExecutor as ScanJobExecutorReg } from "../../services/JobExecution/executors/ScanJobExecutor.js";
import { TransitiveResolveJobExecutor as TransitiveResolveJobExecutorReg } from "../../services/JobExecution/executors/TransitiveResolveJobExecutor.js";
import { PackageScanJobExecutor as PackageScanJobExecutorReg } from "../../services/JobExecution/executors/PackageScanJobExecutor.js";
import { VulnerabilityScanJobExecutor as VulnerabilityScanJobExecutorReg } from "../../services/JobExecution/executors/VulnerabilityScanJobExecutor.js";
import { LicenseScanJobExecutor as LicenseScanJobExecutorReg } from "../../services/JobExecution/executors/LicenseScanJobExecutor.js";
import { GraphRefreshJobExecutor as GraphRefreshJobExecutorReg } from "../../services/JobExecution/executors/GraphRefreshJobExecutor.js";
import { ErrorReporter } from "../../services/ErrorReporter/index.js";
import { ScanSchedulerService } from "../../services/ScanScheduler/index.js";
import { EventBus } from "../../services/EventBus/EventBus.js";
import { packageManagerRoutes } from "../packageManager.js";
import { projects } from "#api/db/schema.js";

describe("package manager routes", () => {
    let app: FastifyInstance;
    let testDir: string;
    let db: BetterSQLite3Database;
    let token: string;

    beforeEach(async () => {
        testDir = join(
            tmpdir(),
            `package-manager-route-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
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
        container.register(SecurityServiceReg).inSingletonScope();
        container.register(UpgradeServiceReg).inSingletonScope();
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.register(SharedAuditParserServiceRegistration).inSingletonScope();
        container.register(AuditParserServiceReg).inSingletonScope();
        container.register(PackageManagerServiceReg).inSingletonScope();
        container.register(SharedOsvQueryServiceRegistration).inSingletonScope();
        container.register(VulnerabilityMergerRegistration).inSingletonScope();
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
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(CommandRunner, {
            run: vi.fn(async () => ({ stdout: "4.17.1\n", stderr: "", exitCode: 0 })),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        });
        container.register(SecurityServiceReg).inSingletonScope();
        container.register(UpgradeServiceReg).inSingletonScope();
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.register(SharedAuditParserServiceRegistration).inSingletonScope();
        container.register(AuditParserServiceReg).inSingletonScope();
        container.register(PackageManagerServiceReg).inSingletonScope();
        container.register(SharedOsvQueryServiceRegistration).inSingletonScope();
        container.register(VulnerabilityMergerRegistration).inSingletonScope();
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

        const jobWorker = container.resolve(JobWorker);

        const localApp = Fastify();
        localApp.addHook("onRequest", createAuthHook(container));
        await localApp.register(packageManagerRoutes, { container });
        await localApp.ready();

        const response = await localApp.inject({
            headers: { authorization: `Bearer ${token}` },
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

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(CommandRunner, {
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
        container.register(SecurityServiceReg).inSingletonScope();
        container.register(UpgradeServiceReg).inSingletonScope();
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.register(SharedAuditParserServiceRegistration).inSingletonScope();
        container.register(AuditParserServiceReg).inSingletonScope();
        container.register(PackageManagerServiceReg).inSingletonScope();
        container.register(SharedOsvQueryServiceRegistration).inSingletonScope();
        container.register(VulnerabilityMergerRegistration).inSingletonScope();
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

        const jobWorker = container.resolve(JobWorker);

        const localApp = Fastify();
        localApp.addHook("onRequest", createAuthHook(container));
        await localApp.register(packageManagerRoutes, { container });
        await localApp.ready();

        const response = await localApp.inject({
            headers: { authorization: `Bearer ${token}` },
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
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(CommandRunner, {
            run: vi.fn(async () => ({ stdout: "4.17.1\n", stderr: "", exitCode: 0 })),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        });
        container.register(SecurityServiceReg).inSingletonScope();
        container.register(UpgradeServiceReg).inSingletonScope();
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.register(SharedAuditParserServiceRegistration).inSingletonScope();
        container.register(AuditParserServiceReg).inSingletonScope();
        container.register(PackageManagerServiceReg).inSingletonScope();
        container.register(SharedOsvQueryServiceRegistration).inSingletonScope();
        container.register(VulnerabilityMergerRegistration).inSingletonScope();
        container.register(OsvCacheServiceReg).inSingletonScope();
        container.register(VulnerabilityServiceReg).inSingletonScope();
        container.register(LicenseCheckerServiceReg).inSingletonScope();
        container.register(LicensePolicyServiceReg).inSingletonScope();
        container.register(ScanServiceReg).inSingletonScope();
        container.register(RegistryCacheServiceReg).inSingletonScope();
        container.register(WebSocketBroadcasterReg).inSingletonScope();
        container.registerInstance(JobWorker, {
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
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        const localApp = Fastify();
        localApp.addHook("onRequest", createAuthHook(container));
        await localApp.register(packageManagerRoutes, { container });
        await localApp.ready();

        const response = await localApp.inject({
            headers: { authorization: `Bearer ${token}` },
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
