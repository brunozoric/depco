// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { LicensesGateway as LicensesGatewayAbstraction } from "../../../features/Licenses/abstractions/LicensesGateway.js";
import type { LicensesGateway } from "../../../features/Licenses/abstractions/LicensesGateway.js";
import { LicensesRepository as LicensesRepositoryRegistration } from "../../../features/Licenses/LicensesRepository.js";
import { LoadLicensesUseCase as LoadLicensesUseCaseRegistration } from "../useCases/LoadLicensesUseCase.js";
import { ManagePolicyRulesUseCase as ManagePolicyRulesUseCaseRegistration } from "../useCases/ManagePolicyRulesUseCase.js";
import { ScanLicensesUseCase as ScanLicensesUseCaseRegistration } from "../useCases/ScanLicensesUseCase.js";
import { EventBridge as EventBridgeAbstraction } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import { LicensesPresenter } from "../LicensesList/abstractions/LicensesPresenter.js";
import { LicensesPresenter as LicensesPresenterRegistration } from "../LicensesList/LicensesPresenter.js";
import { ProjectsRepository as ProjectsRepositoryAbstraction } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseAbstraction } from "../../Projects/useCases/abstractions/LoadProjectsUseCase.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";
import { UrlFilterFeature } from "../../../features/UrlFilter/feature.js";

function setUrlParams(params: Record<string, string>): void {
    const search = new URLSearchParams(params).toString();
    Object.defineProperty(window, "location", {
        writable: true,
        value: { ...window.location, search: search ? `?${search}` : "", pathname: "/licenses" }
    });
}

interface RecordedGatewayCall {
    method: string;
    args: unknown;
}

interface MockGatewayState {
    licenses: LicensesGateway.LicenseItem[];
    licensesTotal: number;
    violations: LicensesGateway.Violation[];
    violationsTotal: number;
    summary: LicensesGateway.SummaryData;
    policies: LicensesGateway.PolicyRule[];
}

interface MockGatewayHandle {
    gateway: LicensesGateway.Interface;
    state: MockGatewayState;
    calls: RecordedGatewayCall[];
}

function defaultSummary(): LicensesGateway.SummaryData {
    return {
        totalPackages: 0,
        compliantPercent: 100,
        riskTierCounts: {
            permissive: 0,
            "weak-copyleft": 0,
            copyleft: 0,
            proprietary: 0,
            unknown: 0
        },
        violationCounts: { warn: 0, deny: 0 },
        projectSummaries: []
    };
}

function createMockGateway(initial?: Partial<MockGatewayState>): MockGatewayHandle {
    const state: MockGatewayState = {
        licenses: initial?.licenses ?? [],
        licensesTotal: initial?.licensesTotal ?? 0,
        violations: initial?.violations ?? [],
        violationsTotal: initial?.violationsTotal ?? 0,
        summary: initial?.summary ?? defaultSummary(),
        policies: initial?.policies ?? []
    };
    const calls: RecordedGatewayCall[] = [];

    const gateway: LicensesGateway.Interface = {
        list: async (filters?: LicensesGateway.ListFilters) => {
            calls.push({ method: "list", args: filters });
            return { items: state.licenses, total: state.licensesTotal };
        },
        getByProject: async () => ({ items: state.licenses, total: state.licensesTotal }),
        getSummary: async () => {
            calls.push({ method: "getSummary", args: undefined });
            return state.summary;
        },
        scan: async (projectId: string) => {
            calls.push({ method: "scan", args: projectId });
            return { jobId: "job-1" };
        },
        listPolicies: async () => {
            calls.push({ method: "listPolicies", args: undefined });
            return { items: state.policies };
        },
        createPolicy: async input => {
            calls.push({ method: "createPolicy", args: input });
            const rule: LicensesGateway.PolicyRule = {
                id: `rule-${state.policies.length + 1}`,
                action: input.action,
                licensePattern: input.licensePattern ?? null,
                packagePattern: input.packagePattern ?? null,
                projectId: input.projectId ?? null,
                priority: input.priority,
                reason: input.reason ?? null,
                createdAt: 0,
                updatedAt: 0
            };
            state.policies = [...state.policies, rule];
            return rule;
        },
        updatePolicy: async (id, input) => {
            calls.push({ method: "updatePolicy", args: { id, input } });
            state.policies = state.policies.map(rule =>
                rule.id === id ? { ...rule, ...input } : rule
            );
            const updated = state.policies.find(rule => rule.id === id);
            if (!updated) {
                throw new Error(`Unknown rule ${id}`);
            }
            return updated;
        },
        deletePolicy: async id => {
            calls.push({ method: "deletePolicy", args: id });
            state.policies = state.policies.filter(rule => rule.id !== id);
            return { deleted: true };
        },
        listViolations: async () => {
            calls.push({ method: "listViolations", args: undefined });
            return { items: state.violations, total: state.violationsTotal };
        },
        getViolationsSummary: async () => ({
            total: 0,
            warnCount: 0,
            denyCount: 0,
            byProject: []
        })
    };

    return { gateway, state, calls };
}

function license(overrides: Partial<LicensesGateway.LicenseItem>): LicensesGateway.LicenseItem {
    return {
        id: "lic-1",
        projectId: "p1",
        packageName: "lodash",
        licenseName: "MIT",
        spdxId: "MIT",
        source: "registry",
        riskTier: "permissive",
        licenseUrl: null,
        scannedAt: 1000,
        ...overrides
    };
}

function violation(overrides: Partial<LicensesGateway.Violation>): LicensesGateway.Violation {
    return {
        id: "viol-1",
        licenseId: "lic-1",
        ruleId: "rule-1",
        projectId: "p1",
        packageName: "lodash",
        action: "warn",
        scannedAt: 1000,
        ...overrides
    };
}

interface MockProject {
    id: string;
    name: string;
}

interface MockEventBridge {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
}

describe("LicensesPresenter", () => {
    let eventBridgeMock: MockEventBridge;

    function createPresenter(
        mockGateway: MockGatewayHandle,
        projects: MockProject[] = []
    ): LicensesPresenter.Interface {
        const container = createContainer();

        container.registerInstance(LicensesGatewayAbstraction, mockGateway.gateway);
        eventBridgeMock = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn()
        };
        container.registerInstance(
            EventBridgeAbstraction,
            eventBridgeMock as unknown as EventBridgeAbstraction.Interface
        );
        container.registerInstance(ProjectsRepositoryAbstraction, {
            getProjects: () =>
                projects.map(p => ({
                    id: p.id,
                    name: p.name,
                    path: `/Projects/${p.name}`,
                    packageManager: null,
                    pmVersion: null,
                    addedAt: 0,
                    lastScannedAt: null,
                    hasNodeModules: false,
                    engineStatus: null,
                    rootEnginesNode: null
                })),
            getProjectsTotal: () => 0,
            setProjects: () => {},
            getProject: () => undefined,
            updateProject: () => {},
            getDependencies: () => undefined,
            setDependencies: () => {},
            getSecurityStatus: () => undefined,
            setSecurityStatus: () => {},
            clear: () => {}
        });
        container.registerInstance(LoadProjectsUseCaseAbstraction, {
            execute: async () => {}
        });
        container.register(LicensesRepositoryRegistration).inSingletonScope();
        TeamFilterFeature.register(container);
        UrlFilterFeature.register(container);
        container.register(LoadLicensesUseCaseRegistration);
        container.register(ManagePolicyRulesUseCaseRegistration);
        container.register(ScanLicensesUseCaseRegistration);
        container.register(LicensesPresenterRegistration);

        return container.resolve(LicensesPresenter);
    }

    let mockGateway: MockGatewayHandle;

    beforeEach(() => {
        mockGateway = createMockGateway();
    });

    afterEach(() => {
        setUrlParams({});
    });

    describe("initial state", () => {
        it("starts with loading true and empty collections before load resolves", () => {
            const presenter = createPresenter(mockGateway);

            expect(presenter.vm.loading).toBe(true);
            expect(presenter.vm.error).toBeNull();
            expect(presenter.vm.licenses).toEqual([]);
            expect(presenter.vm.totalCount).toBe(0);
            expect(presenter.vm.summary).toBeNull();
            expect(presenter.vm.policyRules).toEqual([]);
            expect(presenter.vm.availableProjects).toEqual([]);
            expect(presenter.vm.riskTierFilter).toBeNull();
            expect(presenter.vm.packageNameFilter).toBe("");
            expect(presenter.vm.projectIdFilter).toBeNull();
            expect(presenter.vm.violationFilter).toBeNull();
        });
    });

    describe("after load", () => {
        it("populates licenses and computes the compliance summary", async () => {
            mockGateway.state.licenses = [
                license({ id: "lic-1", packageName: "lodash" }),
                license({
                    id: "lic-2",
                    packageName: "axios",
                    spdxId: "GPL-3.0",
                    riskTier: "copyleft"
                })
            ];
            mockGateway.state.licensesTotal = 2;
            mockGateway.state.summary = {
                totalPackages: 2,
                compliantPercent: 50,
                riskTierCounts: {
                    permissive: 1,
                    "weak-copyleft": 0,
                    copyleft: 1,
                    proprietary: 0,
                    unknown: 0
                },
                violationCounts: { warn: 0, deny: 1 },
                projectSummaries: []
            };
            const presenter = createPresenter(mockGateway);

            await presenter.load();

            expect(presenter.vm.loading).toBe(false);
            expect(presenter.vm.totalCount).toBe(2);
            expect(presenter.vm.licenses.map(row => row.packageName)).toEqual(["lodash", "axios"]);
            expect(presenter.vm.summary).toEqual({
                totalPackages: 2,
                compliantPercent: 50,
                riskTierCounts: {
                    permissive: 1,
                    "weak-copyleft": 0,
                    copyleft: 1,
                    proprietary: 0,
                    unknown: 0
                },
                warnCount: 0,
                denyCount: 1
            });
        });
    });

    describe("filters", () => {
        it("risk tier filter passes riskTier to gateway", async () => {
            mockGateway.state.licenses = [
                license({ id: "lic-2", packageName: "axios", riskTier: "copyleft" }),
                license({ id: "lic-3", packageName: "left-pad", riskTier: "copyleft" })
            ];
            mockGateway.state.licensesTotal = 2;
            setUrlParams({ riskTier: "copyleft" });
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            expect(presenter.vm.riskTierFilter).toBe("copyleft");
            const listCall = mockGateway.calls.find(c => c.method === "list");
            expect((listCall?.args as Record<string, unknown>)?.["riskTier"]).toBe("copyleft");
        });

        it("package name filter passes packageName to gateway", async () => {
            mockGateway.state.licenses = [
                license({ id: "lic-1", packageName: "lodash" }),
                license({ id: "lic-2", packageName: "lodash.merge" })
            ];
            mockGateway.state.licensesTotal = 2;
            setUrlParams({ packageName: "lodash" });
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            expect(presenter.vm.packageNameFilter).toBe("lodash");
            const listCall = mockGateway.calls.find(c => c.method === "list");
            expect((listCall?.args as Record<string, unknown>)?.["packageName"]).toBe("lodash");
        });

        it("violation filter passes violationAction to gateway", async () => {
            mockGateway.state.licenses = [license({ id: "lic-1", packageName: "gpl-lib" })];
            mockGateway.state.licensesTotal = 1;
            mockGateway.state.violations = [
                violation({ id: "v1", licenseId: "lic-1", action: "deny" })
            ];
            mockGateway.state.violationsTotal = 1;
            setUrlParams({ violationAction: "deny" });
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            expect(presenter.vm.violationFilter).toBe("deny");
            const listCall = mockGateway.calls.find(c => c.method === "list");
            expect((listCall?.args as Record<string, unknown>)?.["violationAction"]).toBe("deny");
        });

        it("project id filter passes projectId to gateway", async () => {
            mockGateway.state.licenses = [
                license({ id: "lic-2", packageName: "axios", projectId: "p2" })
            ];
            mockGateway.state.licensesTotal = 1;
            setUrlParams({ projectId: "p2" });
            const presenter = createPresenter(mockGateway, [
                { id: "p1", name: "my-app" },
                { id: "p2", name: "my-lib" }
            ]);
            await presenter.load();

            expect(presenter.vm.projectIdFilter).toBe("p2");
            expect(presenter.vm.licenses.map(row => row.packageName)).toEqual(["axios"]);
            expect(presenter.vm.licenses[0]?.projectName).toBe("my-lib");
            const listCall = mockGateway.calls.find(c => c.method === "list");
            expect((listCall?.args as Record<string, unknown>)?.["projectId"]).toBe("p2");
        });

        it("setRiskTierFilter writes riskTier to the URL and reloads from the API", async () => {
            mockGateway.state.licenses = [
                license({ id: "lic-2", packageName: "axios", riskTier: "copyleft" })
            ];
            mockGateway.state.licensesTotal = 1;
            const presenter = createPresenter(mockGateway);
            await presenter.load();
            const pushStateSpy = vi.spyOn(window.history, "pushState");
            const callsBeforeSetter = mockGateway.calls.length;

            vi.useFakeTimers();
            presenter.setRiskTierFilter("copyleft");

            expect(pushStateSpy).toHaveBeenCalledWith(
                null,
                "",
                expect.stringContaining("riskTier=copyleft")
            );

            // The API reload is triggered by the debounced popstate dispatch.
            vi.advanceTimersByTime(300);
            vi.useRealTimers();
            expect(mockGateway.calls.length).toBeGreaterThan(callsBeforeSetter);
        });

        it("setPackageNameFilter with an empty string removes packageName from the URL", async () => {
            setUrlParams({ packageName: "lodash" });
            const presenter = createPresenter(mockGateway);
            await presenter.load();
            const pushStateSpy = vi.spyOn(window.history, "pushState");

            presenter.setPackageNameFilter("");

            const url = pushStateSpy.mock.calls[0]?.[2] as string;
            expect(url).not.toContain("packageName");
        });

        it("resolves project names from repository and falls back to projectId", async () => {
            mockGateway.state.licenses = [
                license({ id: "lic-1", packageName: "lodash", projectId: "p1" }),
                license({ id: "lic-2", packageName: "axios", projectId: "unknown-id" })
            ];
            mockGateway.state.licensesTotal = 2;
            const presenter = createPresenter(mockGateway, [{ id: "p1", name: "my-app" }]);
            await presenter.load();

            expect(presenter.vm.licenses.find(r => r.projectId === "p1")?.projectName).toBe(
                "my-app"
            );
            expect(presenter.vm.licenses.find(r => r.projectId === "unknown-id")?.projectName).toBe(
                "unknown-id"
            );
        });
    });

    describe("policy rules", () => {
        it("populates policyRules after load", async () => {
            mockGateway.state.policies = [
                {
                    id: "rule-1",
                    action: "deny",
                    licensePattern: "GPL-*",
                    packagePattern: null,
                    projectId: null,
                    priority: 1,
                    reason: "no copyleft",
                    createdAt: 1000,
                    updatedAt: 1000
                }
            ];
            const presenter = createPresenter(mockGateway);

            await presenter.load();

            expect(presenter.vm.policyRules).toEqual([
                {
                    id: "rule-1",
                    action: "deny",
                    licensePattern: "GPL-*",
                    packagePattern: null,
                    projectId: null,
                    priority: 1,
                    reason: "no copyleft"
                }
            ]);
        });

        it("createRule delegates to the use case and reloads policy rules", async () => {
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            await presenter.createRule({ action: "warn", priority: 5, licensePattern: "MPL-*" });

            expect(mockGateway.calls.some(call => call.method === "createPolicy")).toBe(true);
            expect(presenter.vm.policyRules).toHaveLength(1);
            expect(presenter.vm.policyRules[0]?.priority).toBe(5);
        });

        it("updateRule delegates to the use case and reloads policy rules", async () => {
            mockGateway.state.policies = [
                {
                    id: "rule-1",
                    action: "warn",
                    licensePattern: "MPL-*",
                    packagePattern: null,
                    projectId: null,
                    priority: 1,
                    reason: null,
                    createdAt: 1000,
                    updatedAt: 1000
                }
            ];
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            await presenter.updateRule("rule-1", { priority: 9 });

            expect(presenter.vm.policyRules[0]?.priority).toBe(9);
        });

        it("deleteRule delegates to the use case and reloads policy rules", async () => {
            mockGateway.state.policies = [
                {
                    id: "rule-1",
                    action: "warn",
                    licensePattern: "MPL-*",
                    packagePattern: null,
                    projectId: null,
                    priority: 1,
                    reason: null,
                    createdAt: 1000,
                    updatedAt: 1000
                }
            ];
            const presenter = createPresenter(mockGateway);
            await presenter.load();

            await presenter.deleteRule("rule-1");

            expect(presenter.vm.policyRules).toEqual([]);
        });
    });

    describe("scanProject", () => {
        it("triggers a scan for the given project via the gateway", async () => {
            const presenter = createPresenter(mockGateway);

            await presenter.scanProject("p1");

            const scanCall = mockGateway.calls.find(call => call.method === "scan");
            expect(scanCall?.args).toBe("p1");
        });
    });

    describe("error handling", () => {
        it("sets an error message when load fails", async () => {
            const failingGateway = createMockGateway();
            failingGateway.gateway.list = async () => {
                throw new Error("network down");
            };
            const presenter = createPresenter(failingGateway);

            await presenter.load();

            expect(presenter.vm.error).toBe("network down");
            expect(presenter.vm.loading).toBe(false);
        });
    });

    describe("dispose", () => {
        it("should unsubscribe from all events on dispose", () => {
            const presenter = createPresenter(mockGateway);

            presenter.dispose();

            expect(eventBridgeMock.off).toHaveBeenCalledTimes(1);
            const offTypes = eventBridgeMock.off.mock.calls.map((c: unknown[]) => c[0]);
            expect(offTypes).toContain("license-scan:complete");
        });
    });
});
