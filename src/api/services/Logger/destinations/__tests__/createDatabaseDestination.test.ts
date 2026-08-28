import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { sleep } from "#testing/helpers/sleep.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { appLogs } from "#api/db/schema.js";
import { createDatabaseDestination } from "../createDatabaseDestination.js";

describe("createDatabaseDestination", () => {
    let db: ReturnType<typeof createTestApiContainer>["db"];
    let broadcaster: WebSocketBroadcaster.Interface;

    beforeEach(() => {
        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        const ctx = createTestApiContainer();
        db = ctx.db;
    });

    it("inserts a log entry into the database", async () => {
        const { writable } = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine =
            JSON.stringify({
                level: 50,
                time: 1723654800000,
                msg: "Scan failed",
                source: "scan",
                projectId: "p1",
                details: "stack trace"
            }) + "\n";

        writable.write(logLine);

        await sleep(100);

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
        const { writable } = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine =
            JSON.stringify({
                level: 40,
                time: Date.now(),
                msg: "Lockfile stale",
                source: "scan",
                projectId: null
            }) + "\n";

        writable.write(logLine);

        await sleep(100);

        expect(broadcaster.broadcast).toHaveBeenCalledWith(
            "log:created",
            expect.objectContaining({
                level: "warn",
                source: "scan",
                message: "Lockfile stale"
            })
        );
    });

    it("skips HTTP info-level logs", async () => {
        const { writable } = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine =
            JSON.stringify({
                level: 30,
                time: Date.now(),
                msg: "request completed",
                source: "http"
            }) + "\n";

        writable.write(logLine);

        await sleep(100);

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });

    it("persists HTTP error-level logs", async () => {
        const { writable } = createDatabaseDestination({ db, broadcaster, threshold: "info" });

        const logLine =
            JSON.stringify({
                level: 50,
                time: Date.now(),
                msg: "request errored",
                source: "http",
                projectId: null
            }) + "\n";

        writable.write(logLine);

        await sleep(100);

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
    });

    it("respects threshold — skips info when threshold is warn", async () => {
        const { writable } = createDatabaseDestination({ db, broadcaster, threshold: "warn" });

        const logLine =
            JSON.stringify({
                level: 30,
                time: Date.now(),
                msg: "Scan started",
                source: "scan",
                projectId: "p1"
            }) + "\n";

        writable.write(logLine);

        await sleep(100);

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(0);
    });

    it("respects state.thresholdPriority changes at runtime", async () => {
        const { writable, state } = createDatabaseDestination({
            db,
            broadcaster,
            threshold: "warn"
        });

        // Info should be skipped at "warn" threshold
        writable.write(
            JSON.stringify({ level: 30, time: Date.now(), msg: "before", source: "app" }) + "\n"
        );
        await sleep(50);
        expect(await db.select().from(appLogs).all()).toHaveLength(0);

        // Lower threshold to "info" via state mutation (simulates refreshLogLevels)
        state.thresholdPriority = 2; // info priority

        writable.write(
            JSON.stringify({ level: 30, time: Date.now(), msg: "after", source: "app" }) + "\n"
        );
        await sleep(50);

        const rows = await db.select().from(appLogs).all();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.message).toBe("after");
    });
});
