import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    listStepHooksRoute,
    createStepHookRoute,
    updateStepHookRoute,
    deleteStepHookRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { StepHooksGateway } from "../abstractions/StepHooksGateway.js";
import { StepHooksGateway as StepHooksGatewayRegistration } from "../StepHooksGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("StepHooksGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): StepHooksGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(StepHooksGatewayRegistration);

        return container.resolve(StepHooksGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    const hook: StepHooksGateway.StepHook = {
        id: "h1",
        projectId: "p1",
        position: "pre-install",
        name: "lint",
        command: "yarn lint",
        type: "command",
        required: false,
        enabled: true,
        sortOrder: 0,
        source: "db",
        createdAt: 1000,
        updatedAt: 1000
    };

    it("list(projectId) calls listStepHooksRoute and returns the hooks and configSource", async () => {
        const gateway = createGateway();
        mockResult = { items: [hook], configSource: "db" };

        const result = await gateway.list("p1");

        expect(calls).toEqual([
            { route: listStepHooksRoute, args: { params: { id: "p1" }, query: {} } }
        ]);
        expect(result).toEqual({ hooks: [hook], configSource: "db" });
    });

    it("create(projectId, input) calls createStepHookRoute with the input body", async () => {
        const gateway = createGateway();
        mockResult = { item: hook };
        const input: StepHooksGateway.CreateInput = {
            position: "pre-install",
            name: "lint",
            command: "yarn lint",
            type: "command",
            required: false
        };

        const result = await gateway.create("p1", input);

        expect(calls).toEqual([
            { route: createStepHookRoute, args: { params: { id: "p1" }, body: input } }
        ]);
        expect(result).toEqual(hook);
    });

    it("update(projectId, hookId, input) calls updateStepHookRoute with the input body", async () => {
        const gateway = createGateway();
        const updatedHook = { ...hook, enabled: false };
        mockResult = { item: updatedHook };
        const input: StepHooksGateway.UpdateInput = { enabled: false };

        const result = await gateway.update("p1", "h1", input);

        expect(calls).toEqual([
            {
                route: updateStepHookRoute,
                args: { params: { id: "p1", hookId: "h1" }, body: input }
            }
        ]);
        expect(result).toEqual(updatedHook);
    });

    it("remove(projectId, hookId) calls deleteStepHookRoute", async () => {
        const gateway = createGateway();
        mockResult = { deleted: true };

        await gateway.remove("p1", "h1");

        expect(calls).toEqual([
            {
                route: deleteStepHookRoute,
                args: { params: { id: "p1", hookId: "h1" }, body: {} }
            }
        ]);
    });
});
