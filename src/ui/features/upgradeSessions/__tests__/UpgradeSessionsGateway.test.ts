import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    createUpgradeSessionRoute,
    getUpgradeSessionRoute,
    executeUpgradeStepRoute,
    skipUpgradeStepRoute,
    abortUpgradeSessionRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { UpgradeSessionsGateway } from "../abstractions/UpgradeSessionsGateway.js";
import { UpgradeSessionsGateway as UpgradeSessionsGatewayRegistration } from "../UpgradeSessionsGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("UpgradeSessionsGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): UpgradeSessionsGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(UpgradeSessionsGatewayRegistration);

        return container.resolve(UpgradeSessionsGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    const rawSession = {
        id: "s1",
        projectId: "p1",
        status: "active",
        currentStep: "select-packages",
        steps: [
            {
                type: "select-packages",
                status: "active" as const,
                input: {},
                result: {}
            }
        ],
        stepOrder: ["select-packages", "branch", "upgrade", "refresh-transient", "commit"],
        createdAt: 1000,
        updatedAt: 1000
    };

    const expectedSession: UpgradeSessionsGateway.SessionResponse = {
        id: "s1",
        projectId: "p1",
        status: "active",
        currentStep: "select-packages",
        steps: [
            {
                type: "select-packages",
                status: "active",
                input: {},
                result: {}
            }
        ],
        stepOrder: ["select-packages", "branch", "upgrade", "refresh-transient", "commit"],
        createdAt: 1000,
        updatedAt: 1000
    };

    it("createSession calls createUpgradeSessionRoute and returns mapped session", async () => {
        const gateway = createGateway();
        mockResult = { item: rawSession };

        const result = await gateway.createSession("p1");

        expect(calls).toEqual([
            { route: createUpgradeSessionRoute, args: { params: { id: "p1" }, body: {} } }
        ]);
        expect(result).toEqual(expectedSession);
    });

    it("getSession calls getUpgradeSessionRoute and returns mapped session", async () => {
        const gateway = createGateway();
        mockResult = { item: rawSession };

        const result = await gateway.getSession("p1", "s1");

        expect(calls).toEqual([
            {
                route: getUpgradeSessionRoute,
                args: { params: { id: "p1", sessionId: "s1" }, query: {} }
            }
        ]);
        expect(result).toEqual(expectedSession);
    });

    it("executeStep calls executeUpgradeStepRoute with input body", async () => {
        const gateway = createGateway();
        const updatedRaw = { ...rawSession, currentStep: "branch" };
        mockResult = { item: updatedRaw };
        const input = { packages: ["lodash"] };

        const result = await gateway.executeStep("p1", "s1", "select-packages", input);

        expect(calls).toEqual([
            {
                route: executeUpgradeStepRoute,
                args: {
                    params: { id: "p1", sessionId: "s1", stepType: "select-packages" },
                    body: input
                }
            }
        ]);
        expect(result.currentStep).toBe("branch");
    });

    it("skipStep calls skipUpgradeStepRoute", async () => {
        const gateway = createGateway();
        const updatedRaw = {
            ...rawSession,
            currentStep: "upgrade",
            steps: [{ type: "branch", status: "skipped", input: {}, result: {} }]
        };
        mockResult = { item: updatedRaw };

        const result = await gateway.skipStep("p1", "s1", "branch");

        expect(calls).toEqual([
            {
                route: skipUpgradeStepRoute,
                args: { params: { id: "p1", sessionId: "s1", stepType: "branch" }, body: {} }
            }
        ]);
        expect(result.currentStep).toBe("upgrade");
    });

    it("abortSession calls abortUpgradeSessionRoute", async () => {
        const gateway = createGateway();
        const abortedRaw = { ...rawSession, status: "aborted" };
        mockResult = { item: abortedRaw };

        const result = await gateway.abortSession("p1", "s1");

        expect(calls).toEqual([
            {
                route: abortUpgradeSessionRoute,
                args: { params: { id: "p1", sessionId: "s1" }, body: {} }
            }
        ]);
        expect(result.status).toBe("aborted");
    });
});
