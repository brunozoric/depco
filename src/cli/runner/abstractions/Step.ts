import { createAbstraction } from "#shared/index.js";

export interface IStepContext {
    dataDirectory: string;
    envFilePath: string;
    options: Record<string, unknown>;
    results: Map<string, unknown>;
}

export interface IStepResult {
    success: boolean;
    skipped?: boolean;
    message?: string;
}

export interface IStep {
    name: string;
    description: string;
    execute(context: IStepContext): Promise<IStepResult>;
    rollback?(context: IStepContext): Promise<void>;
}

export const Step = createAbstraction<IStep>("Cli/Step");

export namespace Step {
    export type Interface = IStep;
    export type Context = IStepContext;
    export type Result = IStepResult;
}
