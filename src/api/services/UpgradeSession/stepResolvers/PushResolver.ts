import type { IStepExecuteParams, IStepResult } from "./abstractions/StepResolver.js";
import { StepResolver as StepResolverAbstraction } from "./abstractions/StepResolver.js";
import { getNextStep } from "./stepUtils.js";
import { GitService } from "../../Git/index.js";

class PushResolverImpl implements StepResolverAbstraction.Interface {
    public readonly type = "push";
    public readonly required = false;

    public constructor(private readonly gitService: GitService.Interface) {}

    public async execute(params: IStepExecuteParams): Promise<IStepResult> {
        const { projectPath, context, input } = params;
        const branchStep = context.steps.find(s => s.type === "branch");
        let branchName: string;

        if (branchStep?.status === "completed" && branchStep.result["currentBranch"]) {
            branchName = String(branchStep.result["currentBranch"]);
        } else {
            branchName = await this.gitService.getCurrentBranch(projectPath);
        }

        const result = await this.gitService.push(projectPath, "origin", branchName);

        if (!result.success) {
            throw new Error(result.output);
        }

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { remote: "origin", branch: branchName }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }
}

export const PushResolver = StepResolverAbstraction.createImplementation({
    implementation: PushResolverImpl,
    dependencies: [GitService]
});
