import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { listProjectsRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../infrastructure/HttpClient/feature.js";
import { AppLogsFeature } from "../../../../features/AppLogs/feature.js";
import { ProjectsFeature } from "../../../../features/Projects/feature.js";
import { EventBridge } from "../../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../../infrastructure/Events/eventMap.js";
import { AppLogsUseCasesFeature } from "../../useCases/feature.js";
import { ProjectsUseCasesFeature } from "../../../Projects/useCases/feature.js";
import { LogBrowserPresenter as LogBrowserPresenterAbstraction } from "../abstractions/LogBrowserPresenter.js";
import { LogBrowserPresenter as LogBrowserPresenterRegistration } from "../LogBrowserPresenter.js";
import type { AppLogsGateway } from "../../../../features/AppLogs/abstractions/AppLogsGateway.js";
import type { ProjectsGateway } from "../../../../features/Projects/abstractions/ProjectsGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface MockEventBridge {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
}

describe("LogBrowserPresenter", () => {
    let calls: RecordedCall[];
    let logsResult: { items: AppLogsGateway.LogEntry[]; total: number };
    let projectsResult: ProjectsGateway.Project[];
    let eventBridgeMock: MockEventBridge;
    let listLogsError: Error | null;
    let deleteLogsError: Error | null;

    function createPresenter(): LogBrowserPresenterAbstraction.Interface {
        const container: Container = createContainer();

        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                switch (route) {
                    case listLogsRoute:
                        if (listLogsError) {
                            throw listLogsError;
                        }
                        return logsResult as T;
                    case deleteLogsRoute:
                        if (deleteLogsError) {
                            throw deleteLogsError;
                        }
                        return { deleted: 0 } as T;
                    case listProjectsRoute:
                        return { items: projectsResult, total: projectsResult.length } as T;
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        eventBridgeMock = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn()
        };
        container.registerInstance(
            EventBridge,
            eventBridgeMock as unknown as EventBridge.Interface
        );

        AppLogsFeature.register(container);
        ProjectsFeature.register(container);
        AppLogsUseCasesFeature.register(container);
        ProjectsUseCasesFeature.register(container);
        container.register(LogBrowserPresenterRegistration);

        return container.resolve(LogBrowserPresenterAbstraction);
    }

    beforeEach(() => {
        calls = [];
        logsResult = { items: [], total: 0 };
        projectsResult = [];
        listLogsError = null;
        deleteLogsError = null;
    });

    it("vm.projects returns project options mapped from repository", async () => {
        projectsResult = [
            {
                id: "proj-1",
                name: "Alpha",
                path: "/tmp/alpha",
                packageManager: "yarn",
                pmVersion: "4.1.0",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            },
            {
                id: "proj-2",
                name: "Beta",
                path: "/tmp/beta",
                packageManager: null,
                pmVersion: null,
                addedAt: 2000,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.projects).toEqual([
            { label: "Alpha", value: "proj-1" },
            { label: "Beta", value: "proj-2" }
        ]);
    });

    it("vm.projects returns empty array when no projects", async () => {
        projectsResult = [];

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.projects).toEqual([]);
    });

    it("vm.projectFilter is null initially", () => {
        const presenter = createPresenter();

        expect(presenter.vm.projectFilter).toBeNull();
    });

    it("setFilter('project', 'proj-1') sets projectFilter and triggers reload", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("project", "proj-1");

        expect(presenter.vm.projectFilter).toBe("proj-1");

        // Wait for the reload triggered by setFilter.
        await new Promise(resolve => setTimeout(resolve, 0));

        const logsCalls = calls.filter(c => c.route === listLogsRoute);
        expect(logsCalls.length).toBeGreaterThanOrEqual(1);
        expect(logsCalls[0]!.args).toEqual(
            expect.objectContaining({
                query: expect.objectContaining({ projectId: "proj-1" })
            })
        );
    });

    it("load sets loading to true then false", async () => {
        const presenter = createPresenter();
        const promise = presenter.load();

        expect(presenter.vm.loading).toBe(true);

        await promise;

        expect(presenter.vm.loading).toBe(false);
    });

    it("load sets error when use case rejects", async () => {
        listLogsError = new Error("network failure");
        const presenter = createPresenter();

        await presenter.load();

        expect(presenter.vm.error).toBe("network failure");
        expect(presenter.vm.loading).toBe(false);
    });

    it("vm.logs maps log entries with project name resolution", async () => {
        logsResult = {
            items: [
                {
                    id: "log-1",
                    level: "info",
                    source: "api",
                    projectId: "proj-1",
                    message: "hello",
                    details: null,
                    createdAt: 1000
                }
            ],
            total: 1
        };
        projectsResult = [
            {
                id: "proj-1",
                name: "Alpha",
                path: "/tmp/alpha",
                packageManager: "yarn",
                pmVersion: "4.1.0",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.logs).toEqual([
            {
                id: "log-1",
                level: "info",
                source: "api",
                projectName: "Alpha",
                message: "hello",
                details: null,
                createdAt: 1000
            }
        ]);
    });

    it("vm.logs uses projectId as fallback when project not found", async () => {
        logsResult = {
            items: [
                {
                    id: "log-1",
                    level: "error",
                    source: "cli",
                    projectId: "unknown-proj",
                    message: "something",
                    details: null,
                    createdAt: 2000
                }
            ],
            total: 1
        };
        projectsResult = [];

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.logs[0]!.projectName).toBe("unknown-proj");
    });

    it("vm.logs maps projectName to null when projectId is null", async () => {
        logsResult = {
            items: [
                {
                    id: "log-1",
                    level: "info",
                    source: "api",
                    projectId: null,
                    message: "no project",
                    details: null,
                    createdAt: 3000
                }
            ],
            total: 1
        };

        const presenter = createPresenter();
        await presenter.load();

        expect(presenter.vm.logs[0]!.projectName).toBeNull();
    });

    it("setFilter level sends level in query", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("level", "error");

        expect(presenter.vm.levelFilter).toBe("error");

        await new Promise(resolve => setTimeout(resolve, 0));

        const logsCalls = calls.filter(c => c.route === listLogsRoute);
        expect(logsCalls.length).toBeGreaterThanOrEqual(1);
        expect(logsCalls[0]!.args).toEqual(
            expect.objectContaining({
                query: expect.objectContaining({ level: "error" })
            })
        );
    });

    it("setFilter source sends source in query", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("source", "api");

        expect(presenter.vm.sourceFilter).toBe("api");

        await new Promise(resolve => setTimeout(resolve, 0));

        const logsCalls = calls.filter(c => c.route === listLogsRoute);
        expect(logsCalls.length).toBeGreaterThanOrEqual(1);
        expect(logsCalls[0]!.args).toEqual(
            expect.objectContaining({
                query: expect.objectContaining({ source: "api" })
            })
        );
    });

    it("setFilter dateFrom sends from in query", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("dateFrom", "2024-01-01");

        expect(presenter.vm.dateFrom).toBe("2024-01-01");

        await new Promise(resolve => setTimeout(resolve, 0));

        const logsCalls = calls.filter(c => c.route === listLogsRoute);
        expect(logsCalls.length).toBeGreaterThanOrEqual(1);
        expect(logsCalls[0]!.args).toEqual(
            expect.objectContaining({
                query: expect.objectContaining({ from: "2024-01-01" })
            })
        );
    });

    it("setFilter dateTo sends to in query", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setFilter("dateTo", "2024-12-31");

        expect(presenter.vm.dateTo).toBe("2024-12-31");

        await new Promise(resolve => setTimeout(resolve, 0));

        const logsCalls = calls.filter(c => c.route === listLogsRoute);
        expect(logsCalls.length).toBeGreaterThanOrEqual(1);
        expect(logsCalls[0]!.args).toEqual(
            expect.objectContaining({
                query: expect.objectContaining({ to: "2024-12-31" })
            })
        );
    });

    it("clearFilters resets all filters and reloads", async () => {
        const presenter = createPresenter();
        await presenter.load();

        presenter.setFilter("level", "error");
        presenter.setFilter("source", "api");
        await new Promise(resolve => setTimeout(resolve, 0));

        calls = [];
        presenter.clearFilters();

        expect(presenter.vm.levelFilter).toBeNull();
        expect(presenter.vm.sourceFilter).toBeNull();
        expect(presenter.vm.projectFilter).toBeNull();
        expect(presenter.vm.dateFrom).toBeNull();
        expect(presenter.vm.dateTo).toBeNull();
        expect(presenter.vm.page).toBe(0);

        await new Promise(resolve => setTimeout(resolve, 0));

        const logsCalls = calls.filter(c => c.route === listLogsRoute);
        expect(logsCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("toggleDetails sets expandedLogId", () => {
        const presenter = createPresenter();

        presenter.toggleDetails("log-1");

        expect(presenter.vm.expandedLogId).toBe("log-1");
    });

    it("toggleDetails unsets when same id toggled again", () => {
        const presenter = createPresenter();

        presenter.toggleDetails("log-1");
        presenter.toggleDetails("log-1");

        expect(presenter.vm.expandedLogId).toBeNull();
    });

    it("deleteFiltered calls delete then reloads", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        await presenter.deleteFiltered();

        const deleteCalls = calls.filter(c => c.route === deleteLogsRoute);
        const listCalls = calls.filter(c => c.route === listLogsRoute);
        expect(deleteCalls.length).toBe(1);
        expect(listCalls.length).toBe(1);
    });

    it("deleteFiltered sets error when delete fails", async () => {
        const presenter = createPresenter();
        await presenter.load();
        deleteLogsError = new Error("delete failed");

        await presenter.deleteFiltered();

        expect(presenter.vm.error).toBe("delete failed");
        expect(presenter.vm.loading).toBe(false);
    });

    it("setPage changes page and reloads", async () => {
        const presenter = createPresenter();
        await presenter.load();
        calls = [];

        presenter.setPage(2);

        expect(presenter.vm.page).toBe(2);

        await new Promise(resolve => setTimeout(resolve, 0));

        const logsCalls = calls.filter(c => c.route === listLogsRoute);
        expect(logsCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("WebSocket log:created handler prepends log to repository", async () => {
        logsResult = {
            items: [
                {
                    id: "existing-1",
                    level: "info",
                    source: "api",
                    projectId: null,
                    message: "existing",
                    details: null,
                    createdAt: 1000
                }
            ],
            total: 1
        };

        const presenter = createPresenter();
        await presenter.load();

        const logCreatedCall = eventBridgeMock.on.mock.calls.find(
            (c: unknown[]) => c[0] === "log:created"
        );
        const handler = logCreatedCall![1];

        handler({
            id: "ws-1",
            level: "warn",
            source: "websocket",
            projectId: null,
            message: "ws message",
            createdAt: 5000
        });

        expect(presenter.vm.logs[0]!.id).toBe("ws-1");
        expect(presenter.vm.logs[0]!.message).toBe("ws message");
    });

    it("should unsubscribe from all events on dispose", async () => {
        const presenter = createPresenter();
        await presenter.load();

        presenter.dispose();

        expect(eventBridgeMock.off).toHaveBeenCalledTimes(1);
        const offTypes = eventBridgeMock.off.mock.calls.map((c: unknown[]) => c[0]);
        expect(offTypes).toContain("log:created");
    });
});
