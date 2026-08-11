import { createAbstraction } from "#shared/index.js";
import type { ISetProgressInput } from "../executors/abstractions/JobExecutor.js";

export interface IJobExecutionContext {
    appendLog: (line: string) => void;
    setProgress: (input: ISetProgressInput) => void;
    getLogs(): string;
    wasProgressUsed(): boolean;
    dispose(): void;
}

export interface IJobExecutionContextFactoryInput {
    jobId: string;
    referenceId: string;
}

export interface IJobExecutionContextFactory {
    create(input: IJobExecutionContextFactoryInput): IJobExecutionContext;
}

export const JobExecutionContextFactory = createAbstraction<IJobExecutionContextFactory>(
    "Api/JobExecutionContextFactory"
);

export namespace JobExecutionContextFactory {
    export type Interface = IJobExecutionContextFactory;
    export type Input = IJobExecutionContextFactoryInput;
    export type Context = IJobExecutionContext;
}
