// src/api/server.ts
import "dotenv/config";
import { eq } from "drizzle-orm";
import { existsSync, mkdirSync } from "fs";
import { HOUR_MS } from "#shared/time.js";
import { resolve } from "path";
import { pathToFileURL } from "url";
import Fastify from "fastify";
import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import fastifyCompress from "@fastify/compress";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { createContainer } from "#shared/index.js";
import { ApiFeature } from "./feature.js";
import { LoggerService } from "./services/Logger/index.js";
import { JobWorker } from "./services/JobExecution/index.js";
import { ScanSchedulerService } from "./services/ScanScheduler/index.js";
import { EventBus } from "./services/EventBus/index.js";
import { VulnerabilityService } from "./services/Vulnerability/index.js";
import { AutoFixSettingsService } from "./services/AutoFix/index.js";
import { AuthService } from "./services/Auth/index.js";
import { WebSocketBroadcaster } from "./websocket/abstractions/WebSocketBroadcaster.js";
import { createAuthHook } from "./middleware/authHook.js";
import { createDatabaseClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { seedSecurityDefaults } from "./db/seedSecurityDefaults.js";
import { seedAppSettings } from "./db/seedAppSettings.js";
import { appSettings } from "./db/schema.js";
import {
    projectRoutes,
    jobRoutes,
    packageManagerRoutes,
    cacheRoutes,
    settingsRoutes,
    filesystemRoutes,
    installRoutes,
    changelogRoutes,
    packagesRoutes,
    appSettingsRoutes,
    upgradeSessionRoutes,
    logsRoutes,
    backupRoutes,
    stepHooksRoutes,
    dashboardRoutes,
    scanScheduleRoutes,
    vulnerabilityRoutes,
    licenseRoutes,
    licensePolicyRoutes,
    autoFixSettingsRoutes,
    autoFixPrRoutes,
    dependencyGraphRoutes,
    sbomRoutes,
    teamsRoutes,
    userRoutes,
    authRoutes,
    engineRoutes
} from "./routes/index.js";
import { websocketRoutes } from "./websocket/WebSocketPlugin.js";

const DATA_DIR = "./data";
const DB_PATH = process.env["DB_PATH"] ?? "./data/manager.db";
const POLL_INTERVAL_MS = 3000;
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const API_PORT = 3001;

export async function createServer(): Promise<FastifyInstance> {
    // Ensure the SQLite data directory exists before opening the database.
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }

    // Create the DI container and register all API services.
    const databaseClient = createDatabaseClient(DB_PATH);
    const container = createContainer();
    ApiFeature.register(container, { databaseClient });

    // Run pending Drizzle migrations before accepting traffic. This must
    // happen before LoggerService is resolved below — its constructor reads
    // the `log_level` app setting, which requires the app_settings table
    // (and thus migrations) to already exist.
    runMigrations(databaseClient.db);
    seedSecurityDefaults(databaseClient.db);
    seedAppSettings(databaseClient.db);

    const loggerService = container.resolve(LoggerService);
    await loggerService.initFileDestination(DATA_DIR);

    const snoozeIntervalRow = databaseClient.db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, "snooze_check_interval"))
        .get();
    const snoozeCheckIntervalMs = snoozeIntervalRow
        ? parseInt(snoozeIntervalRow.value, 10) || HOUR_MS
        : HOUR_MS;

    const jobWorker = container.resolve(JobWorker);
    await jobWorker.recoverStaleJobs();

    const scanScheduler = container.resolve(ScanSchedulerService);
    await scanScheduler.init();

    const httpLogger: FastifyBaseLogger = loggerService.logger.child({ source: "http" });
    const app = Fastify({ loggerInstance: httpLogger });

    app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
        const statusCode = error.statusCode ?? 500;
        loggerService.logger.error({ source: "server" }, `Route error: ${error.message}`);
        reply.status(statusCode).send({
            error: error.message ?? "Internal error",
            stack: process.env["NODE_ENV"] !== "production" ? error.stack : undefined
        });
    });

    await app.register(fastifyCompress);
    await app.register(fastifyRateLimit, {
        global: false
    });

    // Global auth hook: requires a valid session `Authorization: Bearer`
    // token on every `/api/*` route except the login/verification endpoints.
    // The `/ws` WebSocket upgrade authenticates separately, via a `?token=`
    // query param — see WebSocketPlugin.ts.
    app.addHook("onRequest", createAuthHook(container));

    app.get("/api/health", async (_request, reply) => {
        reply.send({ status: "ok" });
    });

    // Route plugins are registered here, each receiving the DI container via
    // its Fastify plugin options (`{ container }`).
    await app.register(projectRoutes, { container });
    await app.register(jobRoutes, { container });
    await app.register(packageManagerRoutes, { container });
    await app.register(cacheRoutes, { container });
    await app.register(settingsRoutes, { container });
    await app.register(filesystemRoutes, { container });
    await app.register(installRoutes, { container });
    await app.register(changelogRoutes, { container });
    await app.register(packagesRoutes, { container });
    await app.register(appSettingsRoutes, { container });
    await app.register(upgradeSessionRoutes, { container });
    await app.register(logsRoutes, { container });
    await app.register(backupRoutes, { container });
    await app.register(stepHooksRoutes, { container });
    await app.register(dashboardRoutes, { container });
    await app.register(scanScheduleRoutes, { container });
    await app.register(vulnerabilityRoutes, { container });
    await app.register(licenseRoutes, { container });
    await app.register(licensePolicyRoutes, { container });
    await app.register(autoFixSettingsRoutes, { container });
    await app.register(autoFixPrRoutes, { container });
    await app.register(dependencyGraphRoutes, { container });
    await app.register(sbomRoutes, { container });
    await app.register(engineRoutes, { container });
    await app.register(teamsRoutes, { container });
    await app.register(userRoutes, { container });
    await app.register(authRoutes, { container });
    await app.register(websocketRoutes, { container });

    // In production, serve the built UI as static files.
    const distUiPath = resolve("dist/ui");
    if (existsSync(distUiPath)) {
        await app.register(fastifyStatic, {
            root: distUiPath,
            prefix: "/"
        });
    }

    const pollInterval = setInterval(() => {
        jobWorker.processNextJob().catch(error => {
            loggerService.logger.error(
                { source: "server", error: String(error) },
                "Job processing error"
            );
        });
    }, POLL_INTERVAL_MS);

    const eventBus = container.resolve(EventBus);
    eventBus.on("scan:scheduled", (projectId: string) => {
        jobWorker
            .enqueue({ referenceId: projectId, referenceType: "project", type: "scan" })
            .catch(error => {
                loggerService.logger.error(
                    { source: "server", error: String(error) },
                    "Failed to enqueue scheduled scan"
                );
            });
    });

    const autoFixSettingsService = container.resolve(AutoFixSettingsService);
    eventBus.on("scan:completed", async (projectId: string) => {
        try {
            const settings = await autoFixSettingsService.getSettings(projectId);
            if (settings?.enabled) {
                await jobWorker.enqueue({
                    referenceId: projectId,
                    referenceType: "project",
                    type: "auto-fix-pr"
                });
            }
        } catch (error) {
            loggerService.logger.error(
                { source: "server", error: String(error) },
                "Failed to enqueue auto-fix PR"
            );
        }
    });

    // Periodically check for vulnerabilities whose snooze window has recently
    // elapsed, and broadcast their reappearance to connected clients.
    const vulnerabilityService = container.resolve(VulnerabilityService);
    const broadcaster = container.resolve(WebSocketBroadcaster);
    let lastSnoozeCheckMs = Date.now();

    const snoozeCheckInterval = setInterval(async () => {
        try {
            const expired = await vulnerabilityService.getRecentlyExpiredSnoozes(lastSnoozeCheckMs);
            lastSnoozeCheckMs = Date.now();
            if (expired.length > 0) {
                const packageNames = [...new Set(expired.map(v => v.packageName))];
                broadcaster.broadcast("snooze:expired", {
                    count: expired.length,
                    packageNames
                });
            }
        } catch {
            // Non-critical — silently skip failed checks
        }
    }, snoozeCheckIntervalMs);

    // Periodically purge expired sessions and login codes so the sessions/
    // login_codes tables don't grow unbounded.
    const authService = container.resolve(AuthService);
    const sessionCleanupInterval = setInterval(() => {
        authService.cleanupExpired().catch(error => {
            loggerService.logger.error(
                { source: "server", error: String(error) },
                "Session cleanup error"
            );
        });
    }, SESSION_CLEANUP_INTERVAL_MS);

    app.addHook("onClose", async () => {
        await scanScheduler.stop();
        clearInterval(pollInterval);
        clearInterval(snoozeCheckInterval);
        clearInterval(sessionCleanupInterval);
    });

    return app;
}

export async function startServer(): Promise<void> {
    process.on("uncaughtException", error => {
        console.error("Uncaught exception:", error);
    });

    process.on("unhandledRejection", reason => {
        console.error("Unhandled rejection:", reason);
    });

    const app = await createServer();
    await app.listen({ port: API_PORT, host: "0.0.0.0" });
}

const isMainModule =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    startServer().catch(error => {
        console.error("Server failed to start:", error);
        process.exit(1);
    });
}
