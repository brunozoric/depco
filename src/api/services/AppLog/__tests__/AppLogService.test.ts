import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { AppLogService } from "../abstractions/AppLogService.js";
import { appLogs, appSettings } from "#api/db/schema.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ISetupAppLogServiceResult {
    db: TestDb;
    service: AppLogService.Interface;
    broadcaster: WebSocketBroadcaster.Interface;
}

/**
 * LoggerService reads the log_level threshold from appSettings once, at
 * construction time. Since it's a container singleton, the setting must be
 * seeded BEFORE AppLogService (and therefore LoggerService) is resolved.
 */
function setupAppLogService(logLevel?: string): ISetupAppLogServiceResult {
    const { container, db } = createTestApiContainer();

    if (logLevel !== undefined) {
        db.insert(appSettings).values({ key: "log_level", value: logLevel }).run();
    }

    const broadcaster: WebSocketBroadcaster.Interface = {
        broadcast: vi.fn(),
        addClient: vi.fn(),
        removeClient: vi.fn(),
        closeConnectionsForUser: vi.fn()
    };
    container.registerInstance(WebSocketBroadcaster, broadcaster);

    const service = container.resolve(AppLogService);

    return { db, service, broadcaster };
}

// Logging flows through pino's async stream pipeline before it reaches the
// DB destination, so assertions need a short delay after logging.
function flushLogPipeline(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 50));
}

describe("AppLogService", () => {
    it("writes an error log entry to the database", async () => {
        const { db, service } = setupAppLogService();

        await service.log("error", "scan", "p1", "Scan failed", "stack trace");
        await flushLogPipeline();

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            level: "error",
            source: "scan",
            projectId: "p1",
            message: "Scan failed",
            details: "stack trace"
        });
    });

    it("broadcasts log:created event", async () => {
        const { service, broadcaster } = setupAppLogService();

        await service.log("error", "scan", null, "Something broke");
        await flushLogPipeline();

        expect(broadcaster.broadcast).toHaveBeenCalledWith(
            "log:created",
            expect.objectContaining({
                level: "error",
                source: "scan",
                projectId: null,
                message: "Something broke"
            })
        );
    });

    it("writes without details when not provided", async () => {
        const { db, service } = setupAppLogService();

        await service.log("error", "scan", null, "No details");
        await flushLogPipeline();

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.details).toBeNull();
    });

    it("respects log_level setting — skips info when level is warn", async () => {
        const { db, service } = setupAppLogService("warn");

        await service.log("info", "scan", null, "Scan started");
        await flushLogPipeline();

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });

    it("respects log_level setting — allows error when level is warn", async () => {
        const { db, service } = setupAppLogService("warn");

        await service.log("error", "scan", null, "Scan failed");
        await flushLogPipeline();

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
    });

    it("respects log_level setting — allows warn when level is warn", async () => {
        const { db, service } = setupAppLogService("warn");

        await service.log("warn", "scan", null, "Lockfile stale");
        await flushLogPipeline();

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
    });

    it("defaults to warn level when no setting exists", async () => {
        const { db, service } = setupAppLogService();

        await service.log("info", "scan", null, "Should be skipped");
        await flushLogPipeline();

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });
});
