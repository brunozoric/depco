import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    listLicensesRoute,
    listLicenseViolationsRoute,
    getLicenseSummaryRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { LicensesFeature } from "../../../../features/licenses/feature.js";
import { LicensesRepository } from "../../../../features/licenses/abstractions/LicensesRepository.js";
import { LoadLicensesUseCase } from "../abstractions/LoadLicensesUseCase.js";
import { LoadLicensesUseCase as LoadLicensesUseCaseRegistration } from "../LoadLicensesUseCase.js";
import type { LicensesGateway } from "../../../../features/licenses/abstractions/LicensesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: LicensesRepository.Interface;
    useCase: LoadLicensesUseCase.Interface;
}

describe("LoadLicensesUseCase", () => {
    let calls: RecordedCall[];
    let mockResults: Record<string, unknown>;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (route === listLicensesRoute) {
                    return mockResults["licenses"] as T;
                }
                if (route === listLicenseViolationsRoute) {
                    return mockResults["violations"] as T;
                }
                if (route === getLicenseSummaryRoute) {
                    return mockResults["summary"] as T;
                }
                throw new Error("Unexpected route");
            }
        });
        LicensesFeature.register(container);
        container.register(LoadLicensesUseCaseRegistration);

        return {
            repository: container.resolve(LicensesRepository),
            useCase: container.resolve(LoadLicensesUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResults = {
            licenses: { items: [], total: 0 },
            violations: { items: [], total: 0 },
            summary: {
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
            }
        };
    });

    it("fetches licenses, violations and summary, storing all in the repository", async () => {
        const context = createContext();
        const license: LicensesGateway.LicenseItem = {
            id: "lic1",
            projectId: "p1",
            packageName: "lodash",
            licenseName: "MIT",
            spdxId: "MIT",
            source: "registry",
            riskTier: "permissive",
            licenseUrl: null,
            scannedAt: 1000
        };
        const violation: LicensesGateway.Violation = {
            id: "viol1",
            licenseId: "lic1",
            ruleId: "rule1",
            projectId: "p1",
            packageName: "lodash",
            action: "warn",
            scannedAt: 1000
        };
        mockResults["licenses"] = { items: [license], total: 1 };
        mockResults["violations"] = { items: [violation], total: 1 };

        await context.useCase.execute();

        expect(calls).toEqual([
            { route: listLicensesRoute, args: { params: {}, query: undefined } },
            { route: listLicenseViolationsRoute, args: { params: {}, query: undefined } },
            { route: getLicenseSummaryRoute, args: { params: {}, query: {} } }
        ]);
        expect(context.repository.getLicenses()).toEqual([license]);
        expect(context.repository.getLicensesTotal()).toBe(1);
        expect(context.repository.getViolations()).toEqual([violation]);
        expect(context.repository.getViolationsTotal()).toBe(1);
        expect(context.repository.getSummary()).toEqual(mockResults["summary"]);
    });

    it("passes filters through to licenses list and violations", async () => {
        const context = createContext();

        await context.useCase.execute({ projectId: "p1", riskTier: "copyleft" });

        expect(calls[0]).toEqual({
            route: listLicensesRoute,
            args: { params: {}, query: { projectId: "p1", riskTier: "copyleft" } }
        });
        expect(calls[1]).toEqual({
            route: listLicenseViolationsRoute,
            args: { params: {}, query: { projectId: "p1" } }
        });
    });
});
