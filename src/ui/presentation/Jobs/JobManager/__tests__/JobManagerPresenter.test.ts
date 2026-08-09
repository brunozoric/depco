import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import {
    listAllJobsRoute,
    cancelJobRoute,
    deleteJobsRoute,
    listProjectsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../httpClient/feature.js";
import { JobsFeature } from "../../../../features/Jobs/feature.js";
import type { JobsGateway } from "../../../../features/Jobs/abstractions/JobsGateway.js";
import { ProjectsFeature } from "../../../../features/Projects/feature.js";
import { ProjectsRepository } from "../../../../features/Projects/abstractions/ProjectsRepository.js";
import { EventBridge } from "../../../../events/abstractions/EventBridge.js";
import "../../../../events/eventMap.js";
import { LoadAllJobsUseCase as LoadAllJobsUseCaseRegistration } from "../useCases/LoadAllJobsUseCase.js";
import { CancelJobUseCase as CancelJobUseCaseRegistration } from "../useCases/CancelJobUseCase.js";
import { DeleteJobsUseCase as DeleteJobsUseCaseRegistration } from "../useCases/DeleteJobsUseCase.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseRegistration } from "../../../Projects/useCases/LoadProjectsUseCase.js";
import { JobManagerPresenter } from "../abstractions/JobManagerPresenter.js";
import { JobManagerPresenter as JobManagerPresenterRegistration } from "../JobManagerPresenter.js";

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

describe("JobManagerPresenter", () => {
    let calls: RecordedCall[];
    let jobsResult: JobsGateway.Job[];
    let projectsResult: ProjectsRepository.Project[];
    let fakeEventBridge: ReturnType<typeof createFakeEventBridge>;
    let container: Container;

    function createPresenter(): JobManagerPresenter.Interface {
        container = createContainer();

        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                switch (route) {
                    case listAllJobsRoute:
                        return { items: jobsResult, total: jobsResult.length } as T;
                    case listProjectsRoute:
                        return { items: projectsResult, total: projectsResult.length } as T;
                    case cancelJobRoute:
                        return { success: true } as T;
                    case deleteJobsRoute:
                        return { deleted: jobsResult.length } as T;
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        fakeEventBridge = createFakeEventBridge();
        container.registerInstance(EventBridge, fakeEventBridge.bridge);

        ProjectsFeature.register(container);
        JobsFeature.register(container);
        container.register(LoadAllJobsUseCaseRegistration);
        container.register(CancelJobUseCaseRegistration);
        container.register(DeleteJobsUseCaseRegistration);
        container.register(LoadProjectsUseCaseRegistration);
        container.register(JobManagerPresenterRegistration);

        return container.resolve(JobManagerPresenter);
    }

    beforeEach(() => {
        calls = [];
        jobsResult = [];
        projectsResult = [];
    });

    it("starts with an empty, idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            statusFilter: null,
            typeFilter: null,
            referenceFilter: null,
            references: [],
            dateFrom: null,
            dateTo: null,
            jobs: [],
            total: 0,
            page: 0,
            pageSize: 25,
            expandedJobId: null
        });
    });

    it("loads jobs and resolves the project name from ProjectsRepository", async () => {
        const presenter = createPresenter();
        projectsResult = [
            {
                id: "p1",
                name: "my-project",
                path: "/tmp/my-project",
                packageManager: "yarn",
                pmVersion: "4.1.0",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "running",
                packages: null,
                logs: null,
                startedAt: 5000,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];

        await presenter.load();

        expect(calls.filter(c => c.route === listAllJobsRoute)).toEqual([
            {
                route: listAllJobsRoute,
                args: { params: {}, query: { limit: "25", offset: "0" } }
            }
        ]);
        expect(presenter.vm.jobs).toEqual([
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                projectName: "my-project",
                type: "dependency",
                status: "running",
                startedAt: 5000,
                completedAt: null,
                canCancel: true,
                logs: null,
                warning: null,
                parentJobId: null,
                progress: null,
                progressLabel: null
            }
        ]);
    });

    it('shows "Unknown" for jobs whose project is not present in ProjectsRepository', async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "missing-project",
                referenceType: "project",
                type: "dependency",
                status: "completed",
                packages: null,
                logs: null,
                startedAt: 5000,
                completedAt: 6000,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];

        await presenter.load();

        expect(presenter.vm.jobs[0]?.projectName).toBe("Unknown");
    });

    it("sets loading true synchronously while load() is in flight, then false", async () => {
        const presenter = createPresenter();

        const pending = presenter.load();
        expect(presenter.vm.loading).toBe(true);

        await pending;

        expect(presenter.vm.loading).toBe(false);
    });

    it("setStatusFilter updates the filter and triggers a reload with the filter in the query", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        await presenter.setStatusFilter("running");

        expect(presenter.vm.statusFilter).toBe("running");
        expect(calls.filter(c => c.route === listAllJobsRoute)).toEqual([
            {
                route: listAllJobsRoute,
                args: {
                    params: {},
                    query: { status: "running", limit: "25", offset: "0" }
                }
            }
        ]);
    });

    it("clears the filter when setStatusFilter is called with null", async () => {
        const presenter = createPresenter();
        await presenter.setStatusFilter("pending");
        calls = [];

        await presenter.setStatusFilter(null);

        expect(presenter.vm.statusFilter).toBeNull();
        expect(calls.filter(c => c.route === listAllJobsRoute)).toEqual([
            {
                route: listAllJobsRoute,
                args: { params: {}, query: { limit: "25", offset: "0" } }
            }
        ]);
    });

    it("cancel optimistically updates the job status and then calls the gateway", async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "running",
                packages: null,
                logs: null,
                startedAt: 5000,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];
        await presenter.load();
        calls = [];

        await presenter.cancel("job1");

        expect(presenter.vm.jobs[0]?.status).toBe("cancelled");
        expect(presenter.vm.jobs[0]?.canCancel).toBe(false);
        expect(calls).toEqual([{ route: cancelJobRoute, args: { params: { jobId: "job1" } } }]);
    });

    it("updates a matching job's status when a job:status WebSocket event arrives", async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "running",
                packages: null,
                logs: null,
                startedAt: 5000,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            },
            {
                id: "job2",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "pending",
                packages: null,
                logs: null,
                startedAt: null,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];
        await presenter.load();

        fakeEventBridge.emit("job:status", {
            jobId: "job1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });

        expect(presenter.vm.jobs.find(job => job.id === "job1")?.status).toBe("completed");
        expect(presenter.vm.jobs.find(job => job.id === "job2")?.status).toBe("pending");
    });

    it("should unsubscribe from all events on dispose", async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "running",
                packages: null,
                logs: null,
                startedAt: 5000,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];
        await presenter.load();

        presenter.dispose();

        fakeEventBridge.emit("job:status", {
            jobId: "job1",
            referenceId: "p1",
            referenceType: "project",
            type: "dependency",
            status: "completed"
        });

        expect(presenter.vm.jobs.find(job => job.id === "job1")?.status).toBe("running");
        expect(fakeEventBridge.listenerCount("job:status")).toBe(0);
    });

    it.each(["pending", "running"])("canCancel is true when status is %s", async status => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status,
                packages: null,
                logs: null,
                startedAt: null,
                completedAt: null,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];

        await presenter.load();

        expect(presenter.vm.jobs[0]?.canCancel).toBe(true);
    });

    it.each(["completed", "failed", "cancelled"])(
        "canCancel is false when status is %s",
        async status => {
            const presenter = createPresenter();
            jobsResult = [
                {
                    id: "job1",
                    referenceId: "p1",
                    referenceType: "project",
                    type: "dependency",
                    status,
                    packages: null,
                    logs: null,
                    startedAt: null,
                    completedAt: null,
                    warning: null,
                    progress: null,
                    progressLabel: null,
                    parentJobId: null
                }
            ];

            await presenter.load();

            expect(presenter.vm.jobs[0]?.canCancel).toBe(false);
        }
    );

    it("maps logs and warning from the job onto the view model", async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "dependency",
                status: "failed",
                packages: null,
                logs: "line 1\nline 2",
                startedAt: 5000,
                completedAt: 6000,
                warning: "something looked off",
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];

        await presenter.load();

        expect(presenter.vm.jobs[0]?.logs).toBe("line 1\nline 2");
        expect(presenter.vm.jobs[0]?.warning).toBe("something looked off");
    });

    it("toggleJobDetails expands a job's details and collapses it again on a second call", () => {
        const presenter = createPresenter();

        expect(presenter.vm.expandedJobId).toBeNull();

        presenter.toggleJobDetails("job1");
        expect(presenter.vm.expandedJobId).toBe("job1");

        presenter.toggleJobDetails("job1");
        expect(presenter.vm.expandedJobId).toBeNull();
    });

    it("toggleJobDetails switches the expanded job when a different job is toggled", () => {
        const presenter = createPresenter();

        presenter.toggleJobDetails("job1");
        expect(presenter.vm.expandedJobId).toBe("job1");

        presenter.toggleJobDetails("job2");
        expect(presenter.vm.expandedJobId).toBe("job2");
    });

    it("setFilter updates the type filter and reloads with it in the query", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("type", "scan");

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(presenter.vm.typeFilter).toBe("scan");
        expect(calls.filter(c => c.route === listAllJobsRoute)).toEqual([
            {
                route: listAllJobsRoute,
                args: {
                    params: {},
                    query: { type: "scan", limit: "25", offset: "0" }
                }
            }
        ]);
    });

    it("setFilter updates the project filter and reloads", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("reference", "p1");

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(presenter.vm.referenceFilter).toBe("p1");
        expect(calls.filter(c => c.route === listAllJobsRoute)).toEqual([
            {
                route: listAllJobsRoute,
                args: {
                    params: {},
                    query: { referenceId: "p1", limit: "25", offset: "0" }
                }
            }
        ]);
    });

    it("setFilter updates date filters and reloads", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("dateFrom", "1000");

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(presenter.vm.dateFrom).toBe("1000");
        expect(calls.filter(c => c.route === listAllJobsRoute)).toEqual([
            {
                route: listAllJobsRoute,
                args: {
                    params: {},
                    query: { from: "1000", limit: "25", offset: "0" }
                }
            }
        ]);
    });

    it("clearFilters resets all filters and reloads", async () => {
        const presenter = createPresenter();
        await presenter.load();
        await presenter.setStatusFilter("running");
        presenter.setFilter("type", "scan");
        await new Promise(resolve => setTimeout(resolve, 10));
        calls = [];

        presenter.clearFilters();

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(presenter.vm.statusFilter).toBeNull();
        expect(presenter.vm.typeFilter).toBeNull();
        expect(presenter.vm.referenceFilter).toBeNull();
        expect(presenter.vm.dateFrom).toBeNull();
        expect(presenter.vm.dateTo).toBeNull();
        expect(presenter.vm.page).toBe(0);
    });

    it("setPage updates the page and reloads with offset", async () => {
        const presenter = createPresenter();
        jobsResult = new Array(51).fill(null).map((_, i) => ({
            id: `job${i}`,
            referenceId: "p1",
            referenceType: "project",
            type: "scan",
            status: "completed",
            packages: null,
            logs: null,
            startedAt: 5000 + i,
            completedAt: 6000 + i,
            warning: null,
            progress: null,
            progressLabel: null,
            parentJobId: null
        }));
        await presenter.load();
        calls = [];

        presenter.setPage(1);

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(presenter.vm.page).toBe(1);
        expect(calls.filter(c => c.route === listAllJobsRoute)).toEqual([
            {
                route: listAllJobsRoute,
                args: {
                    params: {},
                    query: { limit: "25", offset: "25" }
                }
            }
        ]);
    });

    it("exposes total from the repository", async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                status: "completed",
                packages: null,
                logs: null,
                startedAt: 5000,
                completedAt: 6000,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];

        await presenter.load();

        expect(presenter.vm.total).toBe(1);
    });

    it("exposes project options from ProjectsRepository", async () => {
        const presenter = createPresenter();
        projectsResult = [
            {
                id: "p1",
                name: "project-a",
                path: "/a",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            },
            {
                id: "p2",
                name: "project-b",
                path: "/b",
                packageManager: "npm",
                pmVersion: "10.0.0",
                addedAt: 2000,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];

        await presenter.load();

        expect(presenter.vm.references).toEqual([
            { label: "project-a", value: "p1" },
            { label: "project-b", value: "p2" }
        ]);
    });

    it("resets page to 0 when a filter changes", async () => {
        const presenter = createPresenter();
        await presenter.load();
        presenter.setPage(2);
        await new Promise(resolve => setTimeout(resolve, 10));

        presenter.setFilter("type", "scan");
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(presenter.vm.page).toBe(0);
    });

    it("deleteFiltered sends a delete request with current filters and reloads", async () => {
        const presenter = createPresenter();
        jobsResult = [
            {
                id: "job1",
                referenceId: "p1",
                referenceType: "project",
                type: "scan",
                status: "completed",
                packages: null,
                logs: null,
                startedAt: 5000,
                completedAt: 6000,
                warning: null,
                progress: null,
                progressLabel: null,
                parentJobId: null
            }
        ];
        await presenter.load();
        await presenter.setStatusFilter("completed");
        calls = [];

        await presenter.deleteFiltered();

        const deleteCalls = calls.filter(c => c.route === deleteJobsRoute);
        expect(deleteCalls).toEqual([
            {
                route: deleteJobsRoute,
                args: { params: {}, body: { status: "completed" } }
            }
        ]);
        expect(calls.some(c => c.route === listAllJobsRoute)).toBe(true);
    });
});
