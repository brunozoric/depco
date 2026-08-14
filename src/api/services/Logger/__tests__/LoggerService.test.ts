import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { LoggerService } from "../abstractions/LoggerService.js";

describe("LoggerService", () => {
    beforeEach(() => {
        const broadcaster: WebSocketBroadcaster.Interface = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        const { container } = createTestApiContainer();
        container.registerInstance(WebSocketBroadcaster, broadcaster);

        const service = container.resolve(LoggerService);

        expect(service.logger).toBeDefined();
        expect(typeof service.logger.info).toBe("function");
        expect(typeof service.logger.error).toBe("function");
        expect(typeof service.logger.warn).toBe("function");
        expect(typeof service.logger.debug).toBe("function");
    });

    it("resolves a pino logger from the container", () => {
        // assertions in beforeEach — if we reached here, logger resolved
        expect(true).toBe(true);
    });
});
