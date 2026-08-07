import type { IStepExecuteParams, IStepResult } from "./abstractions/StepResolver.js";
import { StepResolver as StepResolverAbstraction } from "./abstractions/StepResolver.js";
import { getNextStep } from "./abstractions/StepResolver.js";
import { GitService } from "../../Git/index.js";

class BranchResolverImpl implements StepResolverAbstraction.Interface {
    public readonly type = "branch";
    public readonly required = false;

    public constructor(private readonly gitService: GitService.Interface) {}

    public async execute(params: IStepExecuteParams): Promise<IStepResult> {
        const { projectPath, context, input } = params;
        const previousBranch = await this.gitService.getCurrentBranch(projectPath);
        const create = input["create"] === true;

        if (create) {
            const branchName = input["branchName"];
            if (typeof branchName !== "string" || branchName.length === 0) {
                throw new Error("branchName is required when create is true");
            }
            await this.gitService.createAndCheckoutBranch(projectPath, branchName);

            return {
                updatedStep: {
                    type: this.type,
                    status: "completed",
                    input,
                    result: { created: true, previousBranch, currentBranch: branchName }
                },
                nextStep: getNextStep(this.type, context.stepOrder)
            };
        }

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { created: false, previousBranch, currentBranch: previousBranch }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }
}

export const BranchResolver = StepResolverAbstraction.createImplementation({
    implementation: BranchResolverImpl,
    dependencies: [GitService]
});
