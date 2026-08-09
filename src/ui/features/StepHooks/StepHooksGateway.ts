import {
    listStepHooksRoute,
    createStepHookRoute,
    updateStepHookRoute,
    deleteStepHookRoute
} from "#shared/routes/index.js";
import { StepHooksGateway as Abstraction } from "./abstractions/StepHooksGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";

class StepHooksGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(projectId: string): Promise<Abstraction.ListResult> {
        const response = await this.httpClient.request(listStepHooksRoute, {
            params: { id: projectId },
            query: {}
        });
        return {
            hooks: response.items,
            configSource: response.configSource,
            discoveredScripts: response.discoveredScripts
        };
    }

    public async create(
        projectId: string,
        input: Abstraction.CreateInput
    ): Promise<Abstraction.StepHook> {
        const response = await this.httpClient.request(createStepHookRoute, {
            params: { id: projectId },
            body: input
        });
        return response.item;
    }

    public async update(
        projectId: string,
        hookId: string,
        input: Abstraction.UpdateInput
    ): Promise<Abstraction.StepHook> {
        const response = await this.httpClient.request(updateStepHookRoute, {
            params: { id: projectId, hookId },
            body: input
        });
        return response.item;
    }

    public async remove(projectId: string, hookId: string): Promise<void> {
        await this.httpClient.request(deleteStepHookRoute, {
            params: { id: projectId, hookId },
            body: {}
        });
    }
}

export const StepHooksGateway = Abstraction.createImplementation({
    implementation: StepHooksGatewayImpl,
    dependencies: [HTTPClient]
});
