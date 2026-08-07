import { createAbstraction } from "#shared/index.js";

export interface IJobExecutionProject {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
}

export interface ISetProgressInput {
    percent: number;
    label?: string;
}

export interface IJobExecutionContext {
    jobId: string;
    referenceId: string;
    projectPath: string;
    packageManager: string;
    packagesJson: string | null;
    project: IJobExecutionProject | null;
    appendLog: (line: string) => void;
    setProgress: (input: ISetProgressInput) => void;
    signal: AbortSignal;
}

export interface IJobExecutor {
    readonly type: string;
    execute(context: IJobExecutionContext): Promise<void>;
}

export const JobExecutor = createAbstraction<IJobExecutor>("Api/JobExecutor");

export namespace JobExecutor {
    export type Interface = IJobExecutor;
    export type ExecutionContext = IJobExecutionContext;
}
