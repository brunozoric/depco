import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import { getJobRoute, listJobsRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../httpClient/feature.js";
import { UpgradesFeature } from "../../../../features/Upgrades/feature.js";
import { EventBridge } from "../../../../events/abstractions/EventBridge.js";
import "../../../../events/eventMap.js";
import { GetJobUseCase as GetJobUseCaseRegistration } from "../../../upgrades/useCases/GetJobUseCase.js";
import { GetJobsUseCase as GetJobsUseCaseRegistration } from "../../../upgrades/useCases/GetJobsUseCase.js";
import { JobProgressPresenter } from "../abstractions/JobProgressPresenter.js";
import { JobProgressPresenter as JobProgressPresenterRegistration } from "../JobProgressPresenter.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

function createFakeEventBridge(): {
    bridge: EventBridge.Interface;
    emit: <K extends EventBridge.EventName>(event: K, data: EventBridge.EventMap[K]) => void;
    listenerCount: (event: EventBridge.EventName) => number;
} {
    const handlers = new Map<string, Set<(data: unknown) => void>>();

    const bridge: EventBridge.Interface = {
        on: (event, handler) => {
            let set = handlers.get(event);
            if (!set) {
                set = new Set();
                handlers.set(event, set);
            }
            set.add(handler as (data: unknown) => void);
        },
        off: (event, handler) => {
            handlers.get(event)?.delete(handler as (data: unknown) => void);
        },
        emit: (event, data) => {
            for (const handler of handlers.get(event) ?? []) {
                handler(data);
            }
        }
    };

    function listenerCount(event: EventBridge.EventName): number {
        return handlers.get(event)?.size ?? 0;
    }

    return { bridge, emit: bridge.emit, listenerCount };
}

describe("JobProgressPresenter", () => {
    let calls: RecordedCall[];
    let jobResult: Record<string, unknown>;
    let jobsResult: unknown;
    let fakeEventBridge: ReturnType<typeof createFakeEventBridge>;

    function createPresenter(): JobProgressPresenter.Interface {
        const container: Container = createContainer();

        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (route === getJobRoute) {
                    return { item: jobResult } as T;
                }
                if (route === listJobsRoute) {
                    return { items: jobsResult, total: (jobsResult as []).length } as T;
                }
                throw new Error(`Unexpected route ${JSON.stringify(route)}`);
            }
        });

        fakeEventBridge = createFakeEventBridge();
        container.registerInstance(EventBridge, fakeEventBridge.bridge);

        UpgradesFeature.register(container);
        container.register(GetJobUseCaseRegistration);
        container.register(GetJobsUseCaseRegistration);
        container.register(JobProgressPresenterRegistration);

        return container.resolve(JobProgressPresenter);
    }

    beforeEach(() => {
        calls = [];
        jobResult = {
            id: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "running",
            packages: null,
            logs: "starting",
            startedAt: 1000,
            completedAt: null,
            warning: null
        };
        jobsResult = [];
    });

    it("starts with an empty, idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            activeJob: null,
            history: [],
            tracking: false
        });
    });

    it("trackJob fetches the job immediately and registers WS listeners", async () => {
        const presenter = createPresenter();

        await presenter.trackJob("p1", "job-1");

        expect(calls).toEqual([
            { route: getJobRoute, args: { params: { id: "p1", jobId: "job-1" } } }
        ]);
        expect(presenter.vm.activeJob).toEqual({
            id: "job-1",
            type: "dependency",
            status: "running",
            logs: "starting",
            startedAt: 1000,
            completedAt: null,
            progress: null,
            progressLabel: null
        });
        expect(presenter.vm.tracking).toBe(true);
        expect(fakeEventBridge.listenerCount("job:status")).toBe(1);
        expect(fakeEventBridge.listenerCount("job:log")).toBe(1);
        expect(fakeEventBridge.listenerCount("job:progress")).toBe(1);
    });

    it("refetches the job when a matching job:status event arrives", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");
        calls = [];
        jobResult = { ...jobResult, logs: "starting\nstep 2" };

        fakeEventBridge.emit("job:status", {
            jobId: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "running"
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls).toEqual([
            { route: getJobRoute, args: { params: { id: "p1", jobId: "job-1" } } }
        ]);
        expect(presenter.vm.activeJob?.logs).toBe("starting\nstep 2");
        expect(presenter.vm.tracking).toBe(true);
    });

    it("ignores job:status events for a different jobId", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");
        calls = [];

        fakeEventBridge.emit("job:status", {
            jobId: "job-2",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "running"
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls).toEqual([]);
    });

    it("stops tracking and unregisters the WS listener once the job completes", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");
        jobResult = { ...jobResult, status: "completed", completedAt: 2000 };

        fakeEventBridge.emit("job:status", {
            jobId: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(presenter.vm.tracking).toBe(false);
        expect(presenter.vm.activeJob?.status).toBe("completed");
        expect(fakeEventBridge.listenerCount("job:status")).toBe(0);
    });

    it("stops tracking once the job fails", async () => {
        const presenter = createPresenter();
        jobResult = { ...jobResult, status: "failed", completedAt: 2000 };
        await presenter.trackJob("p1", "job-1");

        fakeEventBridge.emit("job:status", {
            jobId: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "failed"
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(presenter.vm.tracking).toBe(false);
        expect(presenter.vm.activeJob?.status).toBe("failed");
    });

    it("untrackJob clears tracking and unregisters WS listeners", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");

        presenter.untrackJob();

        expect(presenter.vm.tracking).toBe(false);
        expect(fakeEventBridge.listenerCount("job:status")).toBe(0);
        expect(fakeEventBridge.listenerCount("job:log")).toBe(0);
        expect(fakeEventBridge.listenerCount("job:progress")).toBe(0);

        calls = [];
        fakeEventBridge.emit("job:status", {
            jobId: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "running"
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls).toEqual([]);
    });

    it("trackJob called again re-registers a fresh listener for the new job", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");

        await presenter.trackJob("p1", "job-2");

        expect(fakeEventBridge.listenerCount("job:status")).toBe(1);

        calls = [];
        fakeEventBridge.emit("job:status", {
            jobId: "job-1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "running"
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(calls).toEqual([]);
    });

    it("appends log lines incrementally when a matching job:log event arrives", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");

        fakeEventBridge.emit("job:log", { jobId: "job-1", referenceId: "p1", line: "step 1" });
        fakeEventBridge.emit("job:log", { jobId: "job-1", referenceId: "p1", line: "step 2" });

        expect(presenter.vm.activeJob?.logs).toBe("starting\nstep 1\nstep 2\n");
    });

    it("ignores job:log events for a different jobId", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");

        fakeEventBridge.emit("job:log", { jobId: "job-2", referenceId: "p1", line: "wrong job" });

        expect(presenter.vm.activeJob?.logs).toBe("starting");
    });

    it("updates progress and progressLabel when a matching job:progress event arrives", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");

        fakeEventBridge.emit("job:progress", {
            jobId: "job-1",
            referenceId: "p1",
            progress: 42,
            progressLabel: "Installing packages"
        });

        expect(presenter.vm.activeJob?.progress).toBe(42);
        expect(presenter.vm.activeJob?.progressLabel).toBe("Installing packages");
    });

    it("ignores job:progress events for a different jobId", async () => {
        const presenter = createPresenter();
        await presenter.trackJob("p1", "job-1");

        fakeEventBridge.emit("job:progress", {
            jobId: "job-2",
            referenceId: "p1",
            progress: 42,
            progressLabel: "wrong job"
        });

        expect(presenter.vm.activeJob?.progress).toBeNull();
        expect(presenter.vm.activeJob?.progressLabel).toBeNull();
    });

    it("loadHistory fetches job history via GetJobsUseCase and exposes it in the view model", async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job-0",
                referenceId: "p1",
                referenceType: "project",
                type: "yarn",
                status: "completed",
                packages: null,
                logs: "done",
                startedAt: 500,
                completedAt: 900,
                warning: null
            }
        ];

        await presenter.loadHistory("p1");

        expect(calls).toEqual([{ route: listJobsRoute, args: { params: { id: "p1" } } }]);
        expect(presenter.vm.history).toEqual([
            {
                id: "job-0",
                type: "yarn",
                status: "completed",
                startedAt: 500,
                completedAt: 900,
                warning: null
            }
        ]);
    });
});
