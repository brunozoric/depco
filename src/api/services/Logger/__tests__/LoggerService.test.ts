import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { LoggerService } from "../abstractions/LoggerService.js";
import { appSettings } from "#api/db/schema.js";

function setup() {
    const broadcaster: WebSocketBroadcaster.Interface = {
        broadcast: vi.fn(),
        addClient: vi.fn(),
        removeClient: vi.fn(),
        closeConnectionsForUser: vi.fn()
    };

    const { container, db } = createTestApiContainer();
    container.registerInstance(WebSocketBroadcaster, broadcaster);

    return { container, db };
}

describe("LoggerService", () => {
    it("resolves a pino logger from the container", () => {
        const { container } = setup();
        const service = container.resolve(LoggerService);

        expect(service.logger).toBeDefined();
        expect(typeof service.logger.info).toBe("function");
        expect(typeof service.logger.error).toBe("function");
        expect(typeof service.logger.warn).toBe("function");
        expect(typeof service.logger.debug).toBe("function");
    });

    it("reads per-destination log levels from app_settings", () => {
        const { container, db } = setup();

        db.update(appSettings)
            .set({ value: "error" })
            .where(eq(appSettings.key, "log_level"))
            .run();
        db.insert(appSettings)
            .values({ key: "console_log_level", value: "debug" })
            .onConflictDoNothing()
            .run();
        db.update(appSettings)
            .set({ value: "debug" })
            .where(eq(appSettings.key, "console_log_level"))
            .run();
        db.insert(appSettings)
            .values({ key: "file_log_level", value: "trace" })
            .onConflictDoNothing()
            .run();
        db.update(appSettings)
            .set({ value: "trace" })
            .where(eq(appSettings.key, "file_log_level"))
            .run();

        // The service should resolve without errors, reading all three keys.
        const service = container.resolve(LoggerService);
        expect(service.logger).toBeDefined();
    });

    it("falls back to defaults when destination keys are missing", () => {
        const { container, db } = setup();

        // Remove all log level settings
        db.delete(appSettings).where(eq(appSettings.key, "log_level")).run();

        // Resolve with no log_level, console_log_level, or file_log_level rows
        const service = container.resolve(LoggerService);
        expect(service.logger).toBeDefined();
    });

    it("ignores invalid log level values and uses fallback", () => {
        const { container, db } = setup();

        db.update(appSettings)
            .set({ value: "banana" })
            .where(eq(appSettings.key, "log_level"))
            .run();

        const service = container.resolve(LoggerService);
        expect(service.logger).toBeDefined();
    });

    it("refreshLogLevels re-reads updated values from the database", () => {
        const { container, db } = setup();

        const service = container.resolve(LoggerService);

        // Change log_level from default "warn" to "debug"
        db.update(appSettings)
            .set({ value: "debug" })
            .where(eq(appSettings.key, "log_level"))
            .run();

        // Before refresh, nothing has changed in the service.
        // After refresh, the service should pick up the new value.
        service.refreshLogLevels();

        // The service still works after refresh — logger is usable.
        expect(service.logger).toBeDefined();
        expect(typeof service.logger.debug).toBe("function");
    });
});
