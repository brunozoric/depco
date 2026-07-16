import { createAbstraction } from "#shared/index.js";

export interface IErrorReporter {
    reportJobFailure(
        jobId: string,
        jobType: string,
        referenceId: string,
        projectContext: string,
        error: unknown,
        logs: string
    ): Promise<void>;

    reportJobWarning(
        jobId: string,
        referenceId: string,
        projectPath: string,
        packageManager: string,
        message: string
    ): Promise<void>;

    reportStepFailure(
        sessionId: string,
        stepType: string,
        referenceId: string,
        projectName: string,
        projectPath: string,
        error: unknown
    ): Promise<void>;
}

export const ErrorReporter = createAbstraction<IErrorReporter>("Api/ErrorReporter");

export namespace ErrorReporter {
    export type Interface = IErrorReporter;
}
