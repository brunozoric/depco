import { describe, it, expect, beforeEach, vi } from "vitest";
import { writeFile, rm } from "fs/promises";
import { join } from "path";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { AppLogService } from "../abstractions/AppLogService.js";
import { appLogs, appSettings } from "#api/db/schema.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

describe("AppLogService", () => {
    let db: TestDb;
    let service: AppLogService.Interface;
    let broadcaster: WebSocketBroadcaster.Interface;

    beforeEach(() => {
        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        const { container, db: testDb } = createTestApiContainer();
        db = testDb;
        container.registerInstance(WebSocketBroadcaster, broadcaster);

        service = container.resolve(AppLogService);
    });

    it("writes an error log entry to the database", async () => {
        await service.log("error", "scan", "p1", "Scan failed", "stack trace");

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
        await service.log("error", "scan", null, "Something broke");

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

    it("respects log_level setting — skips info when level is warn", async () => {
        await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

        await service.log("info", "scan", null, "Scan started");

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });

    it("respects log_level setting — allows error when level is warn", async () => {
        await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

        await service.log("error", "scan", null, "Scan failed");

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
    });

    it("respects log_level setting — allows warn when level is warn", async () => {
        await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

        await service.log("warn", "scan", null, "Lockfile stale");

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
    });

    it("defaults to warn level when no setting exists", async () => {
        await service.log("info", "scan", null, "Should be skipped");

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });

    it("writes without details when not provided", async () => {
        await service.log("error", "scan", null, "No details");

        const rows = await db.select().from(appLogs).all();
        expect(rows[0]!.details).toBeNull();
    });

    it("reads logLevel from global file config when present", async () => {
        // Seed DB with log_level = "warn"
        await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();

        // Write global config with logLevel: "info"
        const configPath = join(process.cwd(), ".dependency-upgrader.json");
        await writeFile(configPath, JSON.stringify({ settings: { logLevel: "info" } }), "utf-8");

        try {
            // Log an info-level entry — should be stored because file config says "info"
            await service.log("info", "test", null, "info message");

            const rows = await db.select().from(appLogs).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]!.level).toBe("info");
        } finally {
            await rm(configPath, { force: true });
        }
    });

    it("falls back to DB log level when file config has no logLevel", async () => {
        await db.insert(appSettings).values({ key: "log_level", value: "error" }).run();

        // Write global config with only branchTemplate, no logLevel
        const configPath = join(process.cwd(), ".dependency-upgrader.json");
        await writeFile(
            configPath,
            JSON.stringify({ settings: { branchTemplate: "chore/deps" } }),
            "utf-8"
        );

        try {
            // Log an info-level entry — should be filtered because DB says "error"
            await service.log("info", "test", null, "info message");

            const rows = await db.select().from(appLogs).all();
            expect(rows).toHaveLength(0);
        } finally {
            await rm(configPath, { force: true });
        }
    });
});
