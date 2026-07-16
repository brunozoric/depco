import { createAbstraction } from "#shared/index.js";

export interface IResolvedStepHook {
    position: string;
    name: string;
    command: string;
    executionType: "command" | "script" | "package-script";
    required: boolean;
    source: "db" | "file" | "package-json";
}

export interface IStepHookService {
    getStepConfig(projectId: string, projectPath: string): Promise<IResolvedStepHook[]>;
}

export const StepHookService = createAbstraction<IStepHookService>("Api/StepHookService");

export namespace StepHookService {
    export type Interface = IStepHookService;
    export type ResolvedStepHook = IResolvedStepHook;
}
