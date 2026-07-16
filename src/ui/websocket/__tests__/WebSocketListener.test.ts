import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { WebSocketListener } from "../abstractions/WebSocketListener.js";
import { WebSocketListener as WebSocketListenerRegistration } from "../WebSocketListener.js";
import { EventBridge } from "../../events/abstractions/EventBridge.js";
import "../../events/eventMap.js";

type MockListener = (event: { data?: string }) => void;

class MockWebSocket {
    public static instances: MockWebSocket[] = [];
    public readyState = 0;
    private readonly listenersByType = new Map<string, Set<MockListener>>();

    public constructor(public readonly url: string) {
        MockWebSocket.instances.push(this);
    }

    public addEventListener(type: string, listener: MockListener): void {
        let listeners = this.listenersByType.get(type);
        if (!listeners) {
            listeners = new Set();
            this.listenersByType.set(type, listeners);
        }
        listeners.add(listener);
    }

    public removeEventListener(type: string, listener: MockListener): void {
        this.listenersByType.get(type)?.delete(listener);
    }

    public send(): void {
        // No-op — tests only assert on received messages, not sent ones.
    }

    public close(): void {
        this.readyState = 3;
        this.emit("close", {});
    }

    public emit(type: string, event: { data?: string }): void {
        for (const listener of this.listenersByType.get(type) ?? []) {
            listener(event);
        }
    }
}

function createFakeEventBridge() {
    return {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    };
}

type FakeEventBridge = ReturnType<typeof createFakeEventBridge>;

function resolveListener(eventBridge: FakeEventBridge): WebSocketListener.Interface {
    const container = createContainer();
    container.registerInstance(EventBridge, eventBridge as unknown as EventBridge.Interface);
    container.register(WebSocketListenerRegistration).inSingletonScope();
    return container.resolve(WebSocketListener);
}

function emitMessage(socket: MockWebSocket, type: string, data: unknown): void {
    socket.emit("message", { data: JSON.stringify({ type, data }) });
}

describe("WebSocketListener", () => {
    let originalWebSocket: unknown;

    beforeEach(() => {
        originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
        MockWebSocket.instances = [];
        vi.useFakeTimers();
        (globalThis as { WebSocket: unknown }).WebSocket = MockWebSocket;
    });

    afterEach(() => {
        (globalThis as { WebSocket: unknown }).WebSocket = originalWebSocket;
        vi.useRealTimers();
    });

    it("has no on/off methods", () => {
        const eventBridge = createFakeEventBridge();
        const listener = resolveListener(eventBridge);

        expect((listener as unknown as { on?: unknown }).on).toBeUndefined();
        expect((listener as unknown as { off?: unknown }).off).toBeUndefined();
    });

    it("emits through the EventBridge when a message arrives", () => {
        const eventBridge = createFakeEventBridge();
        const listener = resolveListener(eventBridge);
        listener.connect();
        const socket = MockWebSocket.instances[0];
        if (!socket) {
            throw new Error("expected a socket to have been created");
        }

        emitMessage(socket, "scan:progress", {
            projectId: "project-1",
            packageName: "react",
            current: 1,
            total: 5
        });

        expect(eventBridge.emit).toHaveBeenCalledWith("scan:progress", {
            projectId: "project-1",
            packageName: "react",
            current: 1,
            total: 5
        });
    });

    it("emits every message received, even for repeated event types", () => {
        const eventBridge = createFakeEventBridge();
        const listener = resolveListener(eventBridge);
        listener.connect();
        const socket = MockWebSocket.instances[0];
        if (!socket) {
            throw new Error("expected a socket to have been created");
        }

        emitMessage(socket, "notification", { message: "hi", level: "info" });
        emitMessage(socket, "notification", { message: "bye", level: "info" });

        expect(eventBridge.emit).toHaveBeenCalledTimes(2);
        expect(eventBridge.emit).toHaveBeenNthCalledWith(1, "notification", {
            message: "hi",
            level: "info"
        });
        expect(eventBridge.emit).toHaveBeenNthCalledWith(2, "notification", {
            message: "bye",
            level: "info"
        });
    });

    it("emits distinct event types independently", () => {
        const eventBridge = createFakeEventBridge();
        const listener = resolveListener(eventBridge);
        listener.connect();
        const socket = MockWebSocket.instances[0];
        if (!socket) {
            throw new Error("expected a socket to have been created");
        }

        emitMessage(socket, "notification", { message: "hi", level: "info" });

        expect(eventBridge.emit).toHaveBeenCalledOnce();
        expect(eventBridge.emit).toHaveBeenCalledWith("notification", {
            message: "hi",
            level: "info"
        });
    });

    it("reconnects with exponential backoff (1s, 2s, 4s) after the socket closes", () => {
        const listener = resolveListener(createFakeEventBridge());
        listener.connect();
        expect(MockWebSocket.instances).toHaveLength(1);

        MockWebSocket.instances[0]?.close();
        expect(MockWebSocket.instances).toHaveLength(1);

        vi.advanceTimersByTime(1000);
        expect(MockWebSocket.instances).toHaveLength(2);

        MockWebSocket.instances[1]?.close();
        vi.advanceTimersByTime(1000);
        expect(MockWebSocket.instances).toHaveLength(2);
        vi.advanceTimersByTime(1000);
        expect(MockWebSocket.instances).toHaveLength(3);

        MockWebSocket.instances[2]?.close();
        vi.advanceTimersByTime(3000);
        expect(MockWebSocket.instances).toHaveLength(3);
        vi.advanceTimersByTime(1000);
        expect(MockWebSocket.instances).toHaveLength(4);
    });

    it("does not reconnect after an explicit disconnect", () => {
        const listener = resolveListener(createFakeEventBridge());
        listener.connect();
        listener.disconnect();

        vi.advanceTimersByTime(10000);
        expect(MockWebSocket.instances).toHaveLength(1);
    });
});
