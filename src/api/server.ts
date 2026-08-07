// src/api/server.ts
import "dotenv/config";
import { eq } from "drizzle-orm";
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import fastifyCompress from "@fastify/compress";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { createContainer } from "#shared/index.js";
import { ApiFeature } from "./feature.js";
import { JobWorker } from "./services/abstractions/JobWorker.js";
import { ScanSchedulerService } from "./services/abstractions/ScanSchedulerService.js";
import { EventBus } from "./services/abstractions/EventBus.js";
import { VulnerabilityService } from "./services/abstractions/VulnerabilityService.js";
import { AutoFixSettingsService } from "./services/abstractions/AutoFixSettingsService.js";
import { WebSocketBroadcaster } from "./websocket/abstractions/WebSocketBroadcaster.js";
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
    teamsRoutes
} from "./routes/index.js";
import { websocketRoutes } from "./websocket/WebSocketPlugin.js";

const DATA_DIR = "./data";
const DB_PATH = process.env["DB_PATH"] ?? "./data/manager.db";
const POLL_INTERVAL_MS = 3000;
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

    // Run pending Drizzle migrations before accepting traffic.
    runMigrations(databaseClient.db);
    seedSecurityDefaults(databaseClient.db);
    seedAppSettings(databaseClient.db);

    const snoozeIntervalRow = databaseClient.db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, "snooze_check_interval"))
        .get();
    const snoozeCheckIntervalMs = snoozeIntervalRow
        ? parseInt(snoozeIntervalRow.value, 10) || 3600000
        : 3600000;

    const jobWorker = container.resolve(JobWorker);
    await jobWorker.recoverStaleJobs();

    const scanScheduler = container.resolve(ScanSchedulerService);
    await scanScheduler.init();

    const app = Fastify({ logger: { level: "error" } });
    await app.register(fastifyCompress);
    await app.register(fastifyRateLimit, { max: 100, timeWindow: "1 minute" });

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
    await app.register(teamsRoutes, { container });
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
        void jobWorker.processNextJob();
    }, POLL_INTERVAL_MS);

    const eventBus = container.resolve(EventBus);
    eventBus.on("scan:scheduled", (projectId: string) => {
        void jobWorker.enqueue({
            referenceId: projectId,
            referenceType: "project",
            type: "scan"
        });
    });

    const autoFixSettingsService = container.resolve(AutoFixSettingsService);
    eventBus.on("scan:completed", async (projectId: string) => {
        const settings = await autoFixSettingsService.getSettings(projectId);
        if (settings?.enabled) {
            void jobWorker.enqueue({
                referenceId: projectId,
                referenceType: "project",
                type: "auto-fix-pr"
            });
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

    app.addHook("onClose", async () => {
        await scanScheduler.stop();
        clearInterval(pollInterval);
        clearInterval(snoozeCheckInterval);
    });

    return app;
}

async function main(): Promise<void> {
    const app = await createServer();
    await app.listen({ port: API_PORT, host: "0.0.0.0" });
}

const isMainModule =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    void main();
}
