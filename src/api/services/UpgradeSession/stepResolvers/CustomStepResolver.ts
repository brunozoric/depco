import { StepResolver } from "./abstractions/StepResolver.js";
import { getNextStep } from "./stepUtils.js";
import type { ICustomStepConfig } from "./abstractions/CustomStepConfig.js";
import type { CommandRunner } from "../../CommandRunner/index.js";

interface ICommandSpec {
    command: string;
    args: string[];
}

export class CustomStepResolver implements StepResolver.Interface {
    public readonly type: string;
    public readonly required: boolean;

    public constructor(
        type: string,
        private readonly config: ICustomStepConfig,
        private readonly commandRunner: CommandRunner.Interface
    ) {
        this.type = type;
        this.required = config.required;
    }

    public async execute(params: StepResolver.ExecuteParams): Promise<StepResolver.Result> {
        const { projectPath, context, input, onProgress } = params;
        const { command, args } = this.buildCommand(context.packageManager);

        const result = await this.commandRunner.runStreaming(command, args, {
            cwd: projectPath,
            onStdout: (line: string) => onProgress?.(line),
            onStderr: (line: string) => onProgress?.(line)
        });

        if (result.exitCode !== 0) {
            if (this.required) {
                throw new Error(
                    `Custom step "${this.config.name}" failed with exit code ${result.exitCode}`
                );
            }

            return {
                updatedStep: {
                    type: this.type,
                    status: "skipped",
                    input,
                    result: {
                        error: `Step failed with exit code ${result.exitCode}`,
                        exitCode: result.exitCode
                    }
                },
                nextStep: getNextStep(this.type, context.stepOrder)
            };
        }

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { output: result.stdout }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }

    private buildCommand(packageManager: string): ICommandSpec {
        switch (this.config.executionType) {
            case "command":
            case "script":
                return { command: "sh", args: ["-c", this.config.command] };
            case "package-script":
                return { command: packageManager, args: ["run", this.config.command] };
        }
    }
}
