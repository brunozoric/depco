import { ErrorReporter as Abstraction } from "./abstractions/ErrorReporter.js";
import { AppLogService } from "./abstractions/AppLogService.js";

function extractError(error: unknown): { message: string; stack: string } {
    if (error instanceof Error) {
        return { message: error.message, stack: error.stack ?? error.message };
    }
    const message = String(error);
    return { message, stack: message };
}

class ErrorReporterImpl implements Abstraction.Interface {
    public constructor(private readonly appLogService: AppLogService.Interface) {}

    public async reportJobFailure(
        jobId: string,
        jobType: string,
        referenceId: string,
        projectContext: string,
        error: unknown,
        logs: string
    ): Promise<void> {
        const { message, stack } = extractError(error);
        await this.appLogService.log(
            "error",
            jobType,
            referenceId,
            `${jobType} failed in ${projectContext}: ${message}`,
            `Job ID: ${jobId}\nProject: ${projectContext}\n\n${stack}\n\nLogs:\n${logs}`
        );
    }

    public async reportJobWarning(
        jobId: string,
        referenceId: string,
        projectPath: string,
        packageManager: string,
        message: string
    ): Promise<void> {
        await this.appLogService.log(
            "warn",
            "scan",
            referenceId,
            message,
            `Project path: ${projectPath}\nPackage manager: ${packageManager}\nJob ID: ${jobId}`
        );
    }

    public async reportStepFailure(
        sessionId: string,
        stepType: string,
        referenceId: string,
        projectName: string,
        projectPath: string,
        error: unknown
    ): Promise<void> {
        const { message, stack } = extractError(error);
        await this.appLogService.log(
            "error",
            "step-resolver",
            referenceId,
            `Step "${stepType}" failed in ${projectName}: ${message}`,
            `Session: ${sessionId}\nProject: ${projectName} (${projectPath})\nStep: ${stepType}\n\n${stack}`
        );
    }
}

export const ErrorReporter = Abstraction.createImplementation({
    implementation: ErrorReporterImpl,
    dependencies: [AppLogService]
});
