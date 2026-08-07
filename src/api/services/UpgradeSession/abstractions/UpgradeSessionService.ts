import { createAbstraction } from "#shared/index.js";
import type { IStepState } from "../stepResolvers/abstractions/StepResolver.js";

export interface IUpgradeSessionRow {
    id: string;
    projectId: string;
    status: string;
    currentStep: string;
    steps: IStepState[];
    stepOrder: string[];
    createdAt: number;
    updatedAt: number;
}

export interface IUpgradeSessionService {
    createSession(projectId: string): Promise<IUpgradeSessionRow>;
    getSession(sessionId: string, projectId: string): Promise<IUpgradeSessionRow | null>;
    executeStep(
        sessionId: string,
        projectId: string,
        stepType: string,
        input: Record<string, unknown>
    ): Promise<IUpgradeSessionRow>;
    skipStep(sessionId: string, projectId: string, stepType: string): Promise<IUpgradeSessionRow>;
    abortSession(sessionId: string, projectId: string): Promise<IUpgradeSessionRow>;
}

export const UpgradeSessionService = createAbstraction<IUpgradeSessionService>(
    "Api/UpgradeSessionService"
);

export namespace UpgradeSessionService {
    export type Interface = IUpgradeSessionService;
    export type Row = IUpgradeSessionRow;
    export type StepState = IStepState;
}
