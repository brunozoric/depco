import { UpgradeSessionsGateway as Abstraction } from "./abstractions/UpgradeSessionsGateway.js";
import type { IUpgradeSessionResponse } from "./abstractions/UpgradeSessionsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    createUpgradeSessionRoute,
    getUpgradeSessionRoute,
    executeUpgradeStepRoute,
    skipUpgradeStepRoute,
    abortUpgradeSessionRoute
} from "#shared/routes/index.js";

function toSession(item: {
    id: string;
    projectId: string;
    status: string;
    currentStep: string;
    steps: Abstraction.StepState[];
    stepOrder: string[];
    createdAt: number;
    updatedAt: number;
}): IUpgradeSessionResponse {
    return {
        id: item.id,
        projectId: item.projectId,
        status: item.status as IUpgradeSessionResponse["status"],
        currentStep: item.currentStep,
        steps: item.steps,
        stepOrder: item.stepOrder,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    };
}

class UpgradeSessionsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async createSession(projectId: string): Promise<Abstraction.SessionResponse> {
        const response = await this.httpClient.request(createUpgradeSessionRoute, {
            params: { id: projectId },
            body: {}
        });
        return toSession(response.item);
    }

    public async getSession(
        projectId: string,
        sessionId: string
    ): Promise<Abstraction.SessionResponse> {
        const response = await this.httpClient.request(getUpgradeSessionRoute, {
            params: { id: projectId, sessionId },
            query: {}
        });
        return toSession(response.item);
    }

    public async executeStep(
        projectId: string,
        sessionId: string,
        stepType: string,
        input: Record<string, unknown>
    ): Promise<Abstraction.SessionResponse> {
        const response = await this.httpClient.request(executeUpgradeStepRoute, {
            params: { id: projectId, sessionId, stepType },
            body: input
        });
        return toSession(response.item);
    }

    public async skipStep(
        projectId: string,
        sessionId: string,
        stepType: string
    ): Promise<Abstraction.SessionResponse> {
        const response = await this.httpClient.request(skipUpgradeStepRoute, {
            params: { id: projectId, sessionId, stepType },
            body: {}
        });
        return toSession(response.item);
    }

    public async abortSession(
        projectId: string,
        sessionId: string
    ): Promise<Abstraction.SessionResponse> {
        const response = await this.httpClient.request(abortUpgradeSessionRoute, {
            params: { id: projectId, sessionId },
            body: {}
        });
        return toSession(response.item);
    }
}

export const UpgradeSessionsGateway = Abstraction.createImplementation({
    implementation: UpgradeSessionsGatewayImpl,
    dependencies: [HTTPClient]
});
