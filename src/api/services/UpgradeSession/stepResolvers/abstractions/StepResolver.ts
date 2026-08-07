import { createAbstraction } from "#shared/index.js";

export interface IStepState {
    type: string;
    status: "pending" | "active" | "completed" | "skipped";
    input: Record<string, unknown>;
    result: Record<string, unknown>;
}

export interface IStepResult {
    updatedStep: IStepState;
    nextStep: string | null;
}

export interface IStepContext {
    steps: IStepState[];
    packageManager: string;
    stepOrder: string[];
}

export interface IStepExecuteParams {
    projectPath: string;
    context: IStepContext;
    input: Record<string, unknown>;
    onProgress?: (log: string) => void;
}

export interface IStepResolver {
    readonly type: string;
    readonly required: boolean;
    execute(params: IStepExecuteParams): Promise<IStepResult>;
}

export const StepResolver = createAbstraction<IStepResolver>("Api/StepResolver");

export namespace StepResolver {
    export type Interface = IStepResolver;
    export type Result = IStepResult;
    export type Context = IStepContext;
    export type ExecuteParams = IStepExecuteParams;
}

export const STEP_ORDER = [
    "select-packages",
    "branch",
    "upgrade",
    "refresh-transient",
    "commit",
    "push",
    "create-pr"
] as const;

export type StepType = (typeof STEP_ORDER)[number];

export function getNextStep(currentType: string, stepOrder: string[]): string | null {
    const index = stepOrder.indexOf(currentType);
    if (index === -1 || index === stepOrder.length - 1) {
        return null;
    }
    return stepOrder[index + 1]!;
}

export function createDefaultSteps(): IStepState[] {
    return STEP_ORDER.map((type, index) => ({
        type,
        status: index === 0 ? ("active" as const) : ("pending" as const),
        input: {},
        result: {}
    }));
}
