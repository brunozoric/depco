import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import {
    createUpgradeSessionRoute,
    getUpgradeSessionRoute,
    executeUpgradeStepRoute,
    skipUpgradeStepRoute,
    abortUpgradeSessionRoute,
    listProjectsRoute,
    listAppSettingsRoute,
    getChangelogsRoute,
    reResolveChangelogsRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { ProjectsFeature } from "../../../../features/Projects/feature.js";
import { AppSettingsFeature } from "../../../../features/AppSettings/feature.js";
import { ProjectsUseCasesFeature } from "../../useCases/feature.js";
import { UpgradeSessionsGateway } from "../../../../features/UpgradeSessions/UpgradeSessionsGateway.js";
import { UpgradeSessionsRepository } from "../../../../features/UpgradeSessions/UpgradeSessionsRepository.js";
import { EventBridge } from "../../../../events/abstractions/EventBridge.js";
import "../../../../events/eventMap.js";
import { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";
import { UpgradeWizardPresenter as UpgradeWizardPresenterRegistration } from "../UpgradeWizardPresenter.js";
import type { UpgradeSessionsGateway as UpgradeSessionsGatewayNS } from "../../../../features/UpgradeSessions/abstractions/UpgradeSessionsGateway.js";

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

function makeSession(
    overrides?: Partial<UpgradeSessionsGatewayNS.SessionResponse>
): UpgradeSessionsGatewayNS.SessionResponse {
    return {
        id: "s1",
        projectId: "p1",
        status: "active",
        currentStep: "select-packages",
        steps: [
            { type: "select-packages", status: "active", input: {}, result: {} },
            { type: "branch", status: "pending", input: {}, result: {} },
            { type: "upgrade", status: "pending", input: {}, result: {} },
            { type: "refresh-transient", status: "pending", input: {}, result: {} },
            { type: "commit", status: "pending", input: {}, result: {} }
        ],
        stepOrder: ["select-packages", "branch", "upgrade", "refresh-transient", "commit"],
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides
    };
}

describe("UpgradeWizardPresenter", () => {
    let calls: RecordedCall[];
    let sessionResult: unknown;
    let sessionError: Error | null;
    let appSettings: unknown[];
    let changelogResult: unknown;
    let fakeEventBridge: ReturnType<typeof createFakeEventBridge>;

    function createPresenter(): UpgradeWizardPresenter.Interface {
        const container: Container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (sessionError) {
                    if (
                        route === createUpgradeSessionRoute ||
                        route === executeUpgradeStepRoute ||
                        route === skipUpgradeStepRoute ||
                        route === abortUpgradeSessionRoute
                    ) {
                        throw sessionError;
                    }
                }
                switch (route) {
                    case listProjectsRoute:
                        return {
                            items: [
                                {
                                    id: "p1",
                                    name: "test-project",
                                    path: "/tmp/test",
                                    packageManager: "yarn",
                                    pmVersion: "4.1.0",
                                    addedAt: 1000,
                                    lastScannedAt: null,
                                    hasNodeModules: false
                                }
                            ],
                            total: 1
                        } as T;
                    case listAppSettingsRoute:
                        return {
                            items: appSettings,
                            configSource: "db",
                            fileManaged: []
                        } as T;
                    case createUpgradeSessionRoute:
                    case executeUpgradeStepRoute:
                    case skipUpgradeStepRoute:
                    case abortUpgradeSessionRoute:
                        return { item: sessionResult } as T;
                    case getUpgradeSessionRoute:
                        return { item: sessionResult } as T;
                    case getChangelogsRoute:
                    case reResolveChangelogsRoute:
                        return changelogResult as T;
                    default:
                        throw new Error(`Unexpected route ${JSON.stringify(route)}`);
                }
            }
        });

        fakeEventBridge = createFakeEventBridge();
        container.registerInstance(EventBridge, fakeEventBridge.bridge);

        ProjectsFeature.register(container);
        AppSettingsFeature.register(container);
        ProjectsUseCasesFeature.register(container);
        container.register(UpgradeSessionsGateway).inSingletonScope();
        container.register(UpgradeSessionsRepository).inSingletonScope();
        container.register(UpgradeWizardPresenterRegistration);

        return container.resolve(UpgradeWizardPresenter);
    }

    beforeEach(() => {
        calls = [];
        sessionResult = undefined;
        sessionError = null;
        appSettings = [];
        changelogResult = undefined;
    });

    it("starts with an idle view model", () => {
        const presenter = createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            error: null,
            session: null,
            activeStep: null,
            projectName: "",
            stepLogs: [],
            branchTemplate: "chore/update-dependencies-${YYYY}-${MM}-${DD}",
            commitTemplate: "chore: update dependencies ${YYYY}-${MM}-${DD}",
            prTitleTemplate: "chore(deps): upgrade ${COUNT} packages",
            prBodyTemplate:
                "## Dependency Upgrades\n\n${PACKAGES_TABLE}\n\n_Generated by Dependency Manager on ${YYYY}-${MM}-${DD}_",
            changelogState: null
        });
    });

    it("load creates a session and populates the view model", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();

        await presenter.load("p1");

        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.error).toBeNull();
        expect(presenter.vm.session).toEqual(session);
        expect(presenter.vm.activeStep).toEqual(session.steps[0]);
        expect(presenter.vm.projectName).toBe("test-project");
    });

    it("load sets error when createSession fails", async () => {
        sessionError = new Error("Session creation failed");
        const presenter = createPresenter();

        await presenter.load("p1");

        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.error).toBe("Session creation failed");
        expect(presenter.vm.session).toBeNull();
    });

    it("load reads branch and commit templates from app settings", async () => {
        const session = makeSession();
        sessionResult = session;
        appSettings = [
            { key: "branch_template", value: "feat/upgrade-${YYYY}" },
            { key: "commit_template", value: "feat: upgrade ${YYYY}" }
        ];
        const presenter = createPresenter();

        await presenter.load("p1");

        expect(presenter.vm.branchTemplate).toBe("feat/upgrade-${YYYY}");
        expect(presenter.vm.commitTemplate).toBe("feat: upgrade ${YYYY}");
    });

    it("load reads pr title and body templates from app settings", async () => {
        const session = makeSession();
        sessionResult = session;
        appSettings = [
            { key: "pr_title_template", value: "feat: upgrade ${COUNT}" },
            { key: "pr_body_template", value: "Body ${PACKAGES_TABLE}" }
        ];
        const presenter = createPresenter();

        await presenter.load("p1");

        expect(presenter.vm.prTitleTemplate).toBe("feat: upgrade ${COUNT}");
        expect(presenter.vm.prBodyTemplate).toBe("Body ${PACKAGES_TABLE}");
    });

    it("executeStep updates the session on success", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        const updatedSession = makeSession({
            currentStep: "branch",
            steps: [
                { type: "select-packages", status: "completed", input: {}, result: {} },
                { type: "branch", status: "active", input: {}, result: {} },
                { type: "upgrade", status: "pending", input: {}, result: {} },
                { type: "refresh-transient", status: "pending", input: {}, result: {} },
                { type: "commit", status: "pending", input: {}, result: {} }
            ]
        });
        sessionResult = updatedSession;

        await presenter.executeStep("select-packages", { packages: ["lodash"] });

        expect(presenter.vm.session?.currentStep).toBe("branch");
        expect(presenter.vm.activeStep?.type).toBe("branch");
        expect(presenter.vm.loading).toBe(false);
    });

    it("executeStep sets error on failure", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        sessionError = new Error("Step failed");

        await presenter.executeStep("select-packages", {});

        expect(presenter.vm.error).toBe("Step failed");
        expect(presenter.vm.loading).toBe(false);
    });

    it("executeStep is a no-op when no session exists", async () => {
        const presenter = createPresenter();

        await presenter.executeStep("select-packages", {});

        expect(calls).toEqual([]);
    });

    it("skipStep updates the session on success", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        const updatedSession = makeSession({
            currentStep: "upgrade",
            steps: [
                { type: "select-packages", status: "completed", input: {}, result: {} },
                { type: "branch", status: "skipped", input: {}, result: {} },
                { type: "upgrade", status: "active", input: {}, result: {} },
                { type: "refresh-transient", status: "pending", input: {}, result: {} },
                { type: "commit", status: "pending", input: {}, result: {} }
            ]
        });
        sessionResult = updatedSession;

        await presenter.skipStep("branch");

        expect(presenter.vm.session?.currentStep).toBe("upgrade");
        expect(presenter.vm.loading).toBe(false);
    });

    it("skipStep sets error on failure", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        sessionError = new Error("Cannot skip required step");

        await presenter.skipStep("select-packages");

        expect(presenter.vm.error).toBe("Cannot skip required step");
        expect(presenter.vm.loading).toBe(false);
    });

    it("skipStep is a no-op when no session exists", async () => {
        const presenter = createPresenter();

        await presenter.skipStep("branch");

        expect(calls).toEqual([]);
    });

    it("abort updates the session status to aborted", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        const abortedSession = makeSession({ status: "aborted" });
        sessionResult = abortedSession;

        await presenter.abort();

        expect(presenter.vm.session?.status).toBe("aborted");
        expect(presenter.vm.loading).toBe(false);
    });

    it("abort sets error on failure", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        sessionError = new Error("Abort failed");

        await presenter.abort();

        expect(presenter.vm.error).toBe("Abort failed");
        expect(presenter.vm.loading).toBe(false);
    });

    it("abort is a no-op when no session exists", async () => {
        const presenter = createPresenter();

        await presenter.abort();

        expect(calls).toEqual([]);
    });

    it("getChangelogs delegates to projectsGateway", async () => {
        changelogResult = {
            items: [{ version: "2.0.0", content: "changelog", source: "github" }],
            total: 1,
            resolving: false
        };
        const presenter = createPresenter();

        const actual = await presenter.getChangelogs("lodash", "1.0.0", "2.0.0");

        expect(actual.entries).toEqual([
            { version: "2.0.0", content: "changelog", source: "github" }
        ]);
    });

    it("reResolveChangelogs delegates to projectsGateway", async () => {
        changelogResult = { items: [], total: 0, resolving: true };
        const presenter = createPresenter();

        const actual = await presenter.reResolveChangelogs("lodash", "1.0.0", "2.0.0");

        expect(actual.resolving).toBe(true);
    });

    describe("WebSocket events", () => {
        it("appends step logs on upgrade-session:step-progress for matching session", async () => {
            const session = makeSession();
            sessionResult = session;
            const presenter = createPresenter();
            await presenter.load("p1");

            fakeEventBridge.emit("upgrade-session:step-progress", {
                sessionId: "s1",
                stepType: "upgrade",
                log: "Installing lodash@2.0.0"
            });

            expect(presenter.vm.stepLogs).toEqual(["Installing lodash@2.0.0"]);
        });

        it("appends multiple log lines in order", async () => {
            const session = makeSession();
            sessionResult = session;
            const presenter = createPresenter();
            await presenter.load("p1");

            fakeEventBridge.emit("upgrade-session:step-progress", {
                sessionId: "s1",
                stepType: "upgrade",
                log: "line 1"
            });
            fakeEventBridge.emit("upgrade-session:step-progress", {
                sessionId: "s1",
                stepType: "upgrade",
                log: "line 2"
            });

            expect(presenter.vm.stepLogs).toEqual(["line 1", "line 2"]);
        });

        it("ignores step-progress events for a different session", async () => {
            const session = makeSession();
            sessionResult = session;
            const presenter = createPresenter();
            await presenter.load("p1");

            fakeEventBridge.emit("upgrade-session:step-progress", {
                sessionId: "other-session",
                stepType: "upgrade",
                log: "should be ignored"
            });

            expect(presenter.vm.stepLogs).toEqual([]);
        });

        it("refreshes session on upgrade-session:step-complete for matching session", async () => {
            const session = makeSession();
            sessionResult = session;
            const presenter = createPresenter();
            await presenter.load("p1");

            const refreshedSession = makeSession({ currentStep: "branch" });
            sessionResult = refreshedSession;

            fakeEventBridge.emit("upgrade-session:step-complete", {
                sessionId: "s1",
                stepType: "select-packages"
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(presenter.vm.session?.currentStep).toBe("branch");
            expect(presenter.vm.stepLogs).toEqual([]);
        });

        it("ignores step-complete events for a different session", async () => {
            const session = makeSession();
            sessionResult = session;
            const presenter = createPresenter();
            await presenter.load("p1");
            calls = [];

            fakeEventBridge.emit("upgrade-session:step-complete", {
                sessionId: "other-session",
                stepType: "select-packages"
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(calls.filter(c => c.route === getUpgradeSessionRoute)).toHaveLength(0);
        });

        it("should unsubscribe from all events on dispose", async () => {
            const session = makeSession();
            sessionResult = session;
            const presenter = createPresenter();
            await presenter.load("p1");

            presenter.dispose();

            fakeEventBridge.emit("upgrade-session:step-progress", {
                sessionId: "s1",
                stepType: "upgrade",
                log: "should be ignored"
            });
            fakeEventBridge.emit("upgrade-session:step-complete", {
                sessionId: "s1",
                stepType: "select-packages"
            });
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(presenter.vm.stepLogs).toEqual([]);
            expect(fakeEventBridge.listenerCount("upgrade-session:step-progress")).toBe(0);
            expect(fakeEventBridge.listenerCount("upgrade-session:step-complete")).toBe(0);
        });
    });

    it("load clears step logs from previous session", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        fakeEventBridge.emit("upgrade-session:step-progress", {
            sessionId: "s1",
            stepType: "upgrade",
            log: "old log"
        });
        expect(presenter.vm.stepLogs).toHaveLength(1);

        const newSession = makeSession({ id: "s2" });
        sessionResult = newSession;
        await presenter.load("p1");

        expect(presenter.vm.stepLogs).toEqual([]);
    });

    it("executeStep clears step logs before executing", async () => {
        const session = makeSession();
        sessionResult = session;
        const presenter = createPresenter();
        await presenter.load("p1");

        fakeEventBridge.emit("upgrade-session:step-progress", {
            sessionId: "s1",
            stepType: "upgrade",
            log: "old log"
        });

        const updatedSession = makeSession({ currentStep: "branch" });
        sessionResult = updatedSession;

        await presenter.executeStep("select-packages", {});

        expect(presenter.vm.stepLogs).toEqual([]);
    });
});
