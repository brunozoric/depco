import { STEP_ORDER } from "./abstractions/StepResolver.js";
import type { IStepState } from "./abstractions/StepResolver.js";
import type { IResolvedStepHook } from "../abstractions/StepHookService.js";

export function toSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function buildStepOrder(hooks: IResolvedStepHook[]): string[] {
    const preHooks = new Map<string, string[]>();
    const postHooks = new Map<string, string[]>();

    for (const hook of hooks) {
        const [position, builtInStep] = hook.position.split(":");
        if (!builtInStep) {
            continue;
        }

        const stepType = `${hook.position}:${toSlug(hook.name)}`;

        if (position === "pre") {
            const existing = preHooks.get(builtInStep) ?? [];
            existing.push(stepType);
            preHooks.set(builtInStep, existing);
        } else if (position === "post") {
            const existing = postHooks.get(builtInStep) ?? [];
            existing.push(stepType);
            postHooks.set(builtInStep, existing);
        }
    }

    const order: string[] = [];
    for (const step of STEP_ORDER) {
        const pre = preHooks.get(step) ?? [];
        order.push(...pre, step);
        const post = postHooks.get(step) ?? [];
        order.push(...post);
    }

    return order;
}

export function createSessionSteps(stepOrder: string[], hooks: IResolvedStepHook[]): IStepState[] {
    const hookByType = new Map<string, IResolvedStepHook>();
    for (const hook of hooks) {
        const stepType = `${hook.position}:${toSlug(hook.name)}`;
        hookByType.set(stepType, hook);
    }

    return stepOrder.map((type, index) => {
        const hook = hookByType.get(type);
        const input: Record<string, unknown> = hook
            ? { name: hook.name, command: hook.command, executionType: hook.executionType }
            : {};

        return {
            type,
            status: index === 0 ? ("active" as const) : ("pending" as const),
            input,
            result: {}
        };
    });
}
