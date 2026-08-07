import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";
import { createContainer } from "#shared/index.js";
import { WebSocketBroadcaster } from "../abstractions/WebSocketBroadcaster.js";
import { WebSocketBroadcaster as WebSocketBroadcasterRegistration } from "../WebSocketBroadcaster.js";

const READY_STATE_OPEN = 1;
const READY_STATE_CLOSED = 3;

interface MockConnection extends WebSocketBroadcaster.Connection {
    send: Mock<(data: string) => void>;
    close: Mock<() => void>;
}

function createMockConnection(readyState: number = READY_STATE_OPEN): MockConnection {
    return {
        readyState,
        send: vi.fn<(data: string) => void>(),
        close: vi.fn<() => void>()
    };
}

function resolveBroadcaster(): WebSocketBroadcaster.Interface {
    const container = createContainer();
    container.register(WebSocketBroadcasterRegistration).inSingletonScope();
    return container.resolve(WebSocketBroadcaster);
}

describe("WebSocketBroadcaster", () => {
    it("sends a JSON-encoded payload to every connected client", () => {
        const broadcaster = resolveBroadcaster();
        const clientA = createMockConnection();
        const clientB = createMockConnection();

        broadcaster.addClient(clientA, "user-a");
        broadcaster.addClient(clientB, "user-b");

        broadcaster.broadcast("scan:progress", {
            projectId: "project-1",
            packageName: "react",
            current: 1,
            total: 10
        });

        const expectedPayload = JSON.stringify({
            type: "scan:progress",
            data: { projectId: "project-1", packageName: "react", current: 1, total: 10 }
        });

        expect(clientA.send).toHaveBeenCalledWith(expectedPayload);
        expect(clientB.send).toHaveBeenCalledWith(expectedPayload);
    });

    it("stops sending to a client after it is removed", () => {
        const broadcaster = resolveBroadcaster();
        const client = createMockConnection();

        broadcaster.addClient(client, "user-a");
        broadcaster.removeClient(client);
        broadcaster.broadcast("notification", { message: "hello", level: "info" });

        expect(client.send).not.toHaveBeenCalled();
    });

    it("skips clients that are not in the open state", () => {
        const broadcaster = resolveBroadcaster();
        const openClient = createMockConnection(READY_STATE_OPEN);
        const closedClient = createMockConnection(READY_STATE_CLOSED);

        broadcaster.addClient(openClient, "user-a");
        broadcaster.addClient(closedClient, "user-b");

        broadcaster.broadcast("scan:complete", { projectId: "project-1", warning: null });

        expect(openClient.send).toHaveBeenCalled();
        expect(closedClient.send).not.toHaveBeenCalled();
    });

    it("silently ignores errors thrown by an individual client's send", () => {
        const broadcaster = resolveBroadcaster();
        const failingClient = createMockConnection();
        failingClient.send.mockImplementation(() => {
            throw new Error("client disconnected mid-send");
        });
        const healthyClient = createMockConnection();

        broadcaster.addClient(failingClient, "user-a");
        broadcaster.addClient(healthyClient, "user-b");

        expect(() => {
            broadcaster.broadcast("notification", { message: "test", level: "error" });
        }).not.toThrow();
        expect(healthyClient.send).toHaveBeenCalled();
    });

    it("closes and removes all connections belonging to a given user", () => {
        const broadcaster = resolveBroadcaster();
        const userAConnection1 = createMockConnection();
        const userAConnection2 = createMockConnection();
        const userBConnection = createMockConnection();

        broadcaster.addClient(userAConnection1, "user-a");
        broadcaster.addClient(userAConnection2, "user-a");
        broadcaster.addClient(userBConnection, "user-b");

        broadcaster.closeConnectionsForUser("user-a");

        expect(userAConnection1.close).toHaveBeenCalled();
        expect(userAConnection2.close).toHaveBeenCalled();
        expect(userBConnection.close).not.toHaveBeenCalled();

        broadcaster.broadcast("notification", { message: "test", level: "info" });
        expect(userAConnection1.send).not.toHaveBeenCalled();
        expect(userAConnection2.send).not.toHaveBeenCalled();
        expect(userBConnection.send).toHaveBeenCalled();
    });

    it("silently ignores errors thrown by an individual connection's close", () => {
        const broadcaster = resolveBroadcaster();
        const failingClient = createMockConnection();
        failingClient.close.mockImplementation(() => {
            throw new Error("connection already closed");
        });

        broadcaster.addClient(failingClient, "user-a");

        expect(() => {
            broadcaster.closeConnectionsForUser("user-a");
        }).not.toThrow();
    });
});
