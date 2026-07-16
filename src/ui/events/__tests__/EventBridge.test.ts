import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { EventBridgeFeature } from "../feature.js";
import { EventBridge } from "../abstractions/EventBridge.js";
import "../eventMap.js";

describe("EventBridge", () => {
    function createEventBridge(): EventBridge.Interface {
        const container = createContainer();
        EventBridgeFeature.register(container);
        return container.resolve(EventBridge);
    }

    it("should fire registered handler on emit", () => {
        const bridge = createEventBridge();
        const handler = vi.fn();

        bridge.on("scan:complete", handler);
        bridge.emit("scan:complete", { projectId: "p1", warning: null });

        expect(handler).toHaveBeenCalledWith({ projectId: "p1", warning: null });
    });

    it("should not fire handler after off", () => {
        const bridge = createEventBridge();
        const handler = vi.fn();

        bridge.on("scan:complete", handler);
        bridge.off("scan:complete", handler);
        bridge.emit("scan:complete", { projectId: "p1", warning: null });

        expect(handler).not.toHaveBeenCalled();
    });

    it("should support multiple handlers per event", () => {
        const bridge = createEventBridge();
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        bridge.on("scan:complete", handler1);
        bridge.on("scan:complete", handler2);
        bridge.emit("scan:complete", { projectId: "p1", warning: null });

        expect(handler1).toHaveBeenCalledOnce();
        expect(handler2).toHaveBeenCalledOnce();
    });

    it("should not crosstalk between event types", () => {
        const bridge = createEventBridge();
        const scanHandler = vi.fn();
        const jobHandler = vi.fn();

        bridge.on("scan:complete", scanHandler);
        bridge.on("job:status", jobHandler);
        bridge.emit("scan:complete", { projectId: "p1", warning: null });

        expect(scanHandler).toHaveBeenCalledOnce();
        expect(jobHandler).not.toHaveBeenCalled();
    });

    it("should not throw when emitting with no handlers", () => {
        const bridge = createEventBridge();

        expect(() => {
            bridge.emit("scan:complete", { projectId: "p1", warning: null });
        }).not.toThrow();
    });
});
