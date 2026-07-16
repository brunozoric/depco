import { createAbstraction } from "#shared/index.js";

export interface IUpgradeStepState {
    type: string;
    status: "pending" | "active" | "completed" | "skipped";
    input: Record<string, unknown>;
    result: Record<string, unknown>;
}

export interface IUpgradeSessionResponse {
    id: string;
    projectId: string;
    status: "active" | "completed" | "aborted";
    currentStep: string;
    steps: IUpgradeStepState[];
    stepOrder: string[];
    createdAt: number;
    updatedAt: number;
}

export interface IUpgradeSessionsGateway {
    createSession(projectId: string): Promise<IUpgradeSessionResponse>;
    getSession(projectId: string, sessionId: string): Promise<IUpgradeSessionResponse>;
    executeStep(
        projectId: string,
        sessionId: string,
        stepType: string,
        input: Record<string, unknown>
    ): Promise<IUpgradeSessionResponse>;
    skipStep(
        projectId: string,
        sessionId: string,
        stepType: string
    ): Promise<IUpgradeSessionResponse>;
    abortSession(projectId: string, sessionId: string): Promise<IUpgradeSessionResponse>;
}

export const UpgradeSessionsGateway = createAbstraction<IUpgradeSessionsGateway>(
    "Ui/UpgradeSessionsGateway"
);

export namespace UpgradeSessionsGateway {
    export type Interface = IUpgradeSessionsGateway;
    export type StepState = IUpgradeStepState;
    export type SessionResponse = IUpgradeSessionResponse;
}
