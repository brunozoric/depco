import type { IStepExecuteParams, IStepResult } from "./abstractions/StepResolver.js";
import { StepResolver as StepResolverAbstraction } from "./abstractions/StepResolver.js";
import { getNextStep } from "./stepUtils.js";
import { GitService } from "../../Git/index.js";

class CommitResolverImpl implements StepResolverAbstraction.Interface {
    public readonly type = "commit";
    public readonly required = false;

    public constructor(private readonly gitService: GitService.Interface) {}

    public async execute(params: IStepExecuteParams): Promise<IStepResult> {
        const { projectPath, context, input } = params;
        const message = input["message"];
        if (typeof message !== "string" || message.length === 0) {
            throw new Error("commit message is required");
        }

        const status = await this.gitService.getStatus(projectPath);
        await this.gitService.stageAll(projectPath);
        const commitHash = await this.gitService.commit(projectPath, message);

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { commitHash, filesChanged: status.length }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }
}

export const CommitResolver = StepResolverAbstraction.createImplementation({
    implementation: CommitResolverImpl,
    dependencies: [GitService]
});
