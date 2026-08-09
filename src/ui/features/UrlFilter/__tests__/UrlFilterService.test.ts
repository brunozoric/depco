// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { createContainer } from "#shared/index.js";
import { UrlFilterService as UrlFilterServiceAbstraction } from "../abstractions/UrlFilterService.js";
import { UrlFilterService } from "../UrlFilterService.js";

const testSchema = z.object({
    projectId: z.string().optional(),
    riskTier: z.string().optional(),
    packageName: z.string().optional()
});

describe("UrlFilterService", () => {
    let service: UrlFilterServiceAbstraction.Interface;
    let originalLocation: Location;

    beforeEach(() => {
        const container = createContainer();
        container.register(UrlFilterService).inSingletonScope();
        service = container.resolve(UrlFilterServiceAbstraction);

        originalLocation = window.location;
        Object.defineProperty(window, "location", {
            writable: true,
            value: {
                ...originalLocation,
                pathname: "/licenses",
                search: "",
                href: "http://localhost/licenses"
            }
        });
    });

    afterEach(() => {
        Object.defineProperty(window, "location", {
            writable: true,
            value: originalLocation
        });
        vi.restoreAllMocks();
    });

    describe("read", () => {
        it("returns empty object when URL has no search params", () => {
            const result = service.read(testSchema);
            expect(result).toEqual({});
        });

        it("returns only keys defined in schema", () => {
            window.location.search = "?projectId=p1&unknown=foo";
            const result = service.read(testSchema);
            expect(result).toEqual({ projectId: "p1" });
            expect(result).not.toHaveProperty("unknown");
        });

        it("returns multiple matching params", () => {
            window.location.search = "?projectId=p1&riskTier=copyleft";
            const result = service.read(testSchema);
            expect(result).toEqual({ projectId: "p1", riskTier: "copyleft" });
        });

        it("ignores params that fail schema validation", () => {
            const strictSchema = z.object({
                count: z.coerce.number().optional()
            });
            window.location.search = "?count=notanumber";
            const result = service.read(strictSchema);
            expect(result).toEqual({});
        });
    });

    describe("update", () => {
        it("adds params to URL", () => {
            const pushStateSpy = vi.spyOn(window.history, "pushState");
            service.update(testSchema, { projectId: "p1" });
            expect(pushStateSpy).toHaveBeenCalledWith(
                null,
                "",
                expect.stringContaining("projectId=p1")
            );
        });

        it("removes params when value is null", () => {
            window.location.search = "?projectId=p1&riskTier=copyleft";
            const pushStateSpy = vi.spyOn(window.history, "pushState");
            service.update(testSchema, { projectId: null });
            const url = pushStateSpy.mock.calls[0]![2] as string;
            expect(url).not.toContain("projectId");
            expect(url).toContain("riskTier=copyleft");
        });

        it("preserves params not in schema", () => {
            window.location.search = "?other=keep";
            const pushStateSpy = vi.spyOn(window.history, "pushState");
            service.update(testSchema, { projectId: "p1" });
            const url = pushStateSpy.mock.calls[0]![2] as string;
            expect(url).toContain("other=keep");
            expect(url).toContain("projectId=p1");
        });

        describe("popstate dispatch", () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it("dispatches popstate event after update", () => {
                const listener = vi.fn();
                window.addEventListener("popstate", listener);
                service.update(testSchema, { projectId: "p1" });
                vi.advanceTimersByTime(300);
                window.removeEventListener("popstate", listener);
                expect(listener).toHaveBeenCalled();
            });
        });
    });

    describe("debounce", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("dispatches popstate after 300ms", () => {
            const pushStateSpy = vi.spyOn(window.history, "pushState");
            const listener = vi.fn();
            window.addEventListener("popstate", listener);

            service.update(testSchema, { projectId: "p1" });
            expect(pushStateSpy).toHaveBeenCalledTimes(1);
            expect(pushStateSpy).toHaveBeenCalledWith(
                null,
                "",
                expect.stringContaining("projectId=p1")
            );
            expect(listener).not.toHaveBeenCalled();

            vi.advanceTimersByTime(300);
            expect(listener).toHaveBeenCalledTimes(1);

            window.removeEventListener("popstate", listener);
        });

        it("coalesces rapid updates into one popstate dispatch", () => {
            const pushStateSpy = vi.spyOn(window.history, "pushState");
            const listener = vi.fn();
            window.addEventListener("popstate", listener);

            service.update(testSchema, { projectId: "p1" });
            vi.advanceTimersByTime(100);
            service.update(testSchema, { projectId: "p2" });
            vi.advanceTimersByTime(300);

            expect(pushStateSpy).toHaveBeenCalledTimes(2);
            const lastUrl = pushStateSpy.mock.calls[1]![2] as string;
            expect(lastUrl).toContain("projectId=p2");
            expect(listener).toHaveBeenCalledTimes(1);

            window.removeEventListener("popstate", listener);
        });

        it("dispatches popstate only after debounce settles", () => {
            const listener = vi.fn();
            window.addEventListener("popstate", listener);
            service.update(testSchema, { projectId: "p1" });
            expect(listener).not.toHaveBeenCalled();
            vi.advanceTimersByTime(300);
            expect(listener).toHaveBeenCalledTimes(1);
            window.removeEventListener("popstate", listener);
        });
    });

    describe("onChange", () => {
        it("calls callback on popstate event", () => {
            const callback = vi.fn();
            const dispose = service.onChange(callback);
            window.dispatchEvent(new PopStateEvent("popstate"));
            expect(callback).toHaveBeenCalledTimes(1);
            dispose();
        });

        it("stops calling callback after dispose", () => {
            const callback = vi.fn();
            const dispose = service.onChange(callback);
            dispose();
            window.dispatchEvent(new PopStateEvent("popstate"));
            expect(callback).not.toHaveBeenCalled();
        });
    });
});
