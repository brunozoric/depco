import type { IStepState } from "./abstractions/StepResolver.js";

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
