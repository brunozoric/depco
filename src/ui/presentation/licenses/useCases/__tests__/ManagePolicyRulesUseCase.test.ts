import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    createLicensePolicyRoute,
    updateLicensePolicyRoute,
    deleteLicensePolicyRoute,
    listLicensePoliciesRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { LicensesFeature } from "../../../../features/licenses/feature.js";
import { LicensesRepository } from "../../../../features/licenses/abstractions/LicensesRepository.js";
import { ManagePolicyRulesUseCase } from "../abstractions/ManagePolicyRulesUseCase.js";
import { ManagePolicyRulesUseCase as ManagePolicyRulesUseCaseRegistration } from "../ManagePolicyRulesUseCase.js";
import type { LicensesGateway } from "../../../../features/licenses/abstractions/LicensesGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: LicensesRepository.Interface;
    useCase: ManagePolicyRulesUseCase.Interface;
}

const policyRule: LicensesGateway.PolicyRule = {
    id: "rule1",
    action: "deny",
    licensePattern: "GPL-*",
    packagePattern: null,
    projectId: null,
    priority: 1,
    reason: "no copyleft",
    createdAt: 1000,
    updatedAt: 1000
};

describe("ManagePolicyRulesUseCase", () => {
    let calls: RecordedCall[];

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                if (route === listLicensePoliciesRoute) {
                    return { items: [policyRule] } as T;
                }
                if (route === deleteLicensePolicyRoute) {
                    return { deleted: true } as T;
                }
                return policyRule as T;
            }
        });
        LicensesFeature.register(container);
        container.register(ManagePolicyRulesUseCaseRegistration);

        return {
            repository: container.resolve(LicensesRepository),
            useCase: container.resolve(ManagePolicyRulesUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
    });

    it("creates a policy and refreshes the repository", async () => {
        const context = createContext();
        const input: LicensesGateway.CreatePolicyInput = {
            action: "deny",
            licensePattern: "GPL-*",
            priority: 1
        };

        await context.useCase.create(input);

        expect(calls).toEqual([
            { route: createLicensePolicyRoute, args: { params: {}, body: input } },
            { route: listLicensePoliciesRoute, args: { params: {}, query: undefined } }
        ]);
        expect(context.repository.getPolicies()).toEqual([policyRule]);
    });

    it("updates a policy and refreshes the repository", async () => {
        const context = createContext();
        const input: LicensesGateway.UpdatePolicyInput = { priority: 2 };

        await context.useCase.update("rule1", input);

        expect(calls).toEqual([
            { route: updateLicensePolicyRoute, args: { params: { id: "rule1" }, body: input } },
            { route: listLicensePoliciesRoute, args: { params: {}, query: undefined } }
        ]);
        expect(context.repository.getPolicies()).toEqual([policyRule]);
    });

    it("removes a policy and refreshes the repository", async () => {
        const context = createContext();

        await context.useCase.remove("rule1");

        expect(calls).toEqual([
            { route: deleteLicensePolicyRoute, args: { params: { id: "rule1" } } },
            { route: listLicensePoliciesRoute, args: { params: {}, query: undefined } }
        ]);
        expect(context.repository.getPolicies()).toEqual([policyRule]);
    });
});
