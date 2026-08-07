import type { IStepExecuteParams, IStepResult } from "./abstractions/StepResolver.js";
import { StepResolver as StepResolverAbstraction } from "./abstractions/StepResolver.js";
import { getNextStep } from "./abstractions/StepResolver.js";
import { ForgeService } from "../../Git/index.js";
import { GitService } from "../../Git/index.js";

class PrResolverImpl implements StepResolverAbstraction.Interface {
    public readonly type = "create-pr";
    public readonly required = false;

    public constructor(
        private readonly forgeService: ForgeService.Interface,
        private readonly gitService: GitService.Interface
    ) {}

    public async execute(params: IStepExecuteParams): Promise<IStepResult> {
        const { projectPath, context, input } = params;
        const pushStep = context.steps.find(s => s.type === "push");

        if (!pushStep || pushStep.status === "skipped") {
            return {
                updatedStep: {
                    type: this.type,
                    status: "skipped",
                    input: {},
                    result: {
                        reason: "Push step was skipped — cannot create PR without a pushed branch."
                    }
                },
                nextStep: getNextStep(this.type, context.stepOrder)
            };
        }

        const forge = await this.forgeService.detectForge(projectPath);
        if (forge === "unknown") {
            throw new Error("Cannot detect git forge from remote URL");
        }

        const branchStep = context.steps.find(s => s.type === "branch");
        const base = branchStep?.result["previousBranch"]
            ? String(branchStep.result["previousBranch"])
            : await this.gitService.getCurrentBranch(projectPath);

        const head = String(pushStep.result["branch"]);
        const title = String(input["title"] ?? "");
        const body = String(input["body"] ?? "");

        const result = await this.forgeService.createPr({
            projectPath,
            title,
            body,
            head,
            base
        });

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { url: result.url, number: result.number }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }
}

export const PrResolver = StepResolverAbstraction.createImplementation({
    implementation: PrResolverImpl,
    dependencies: [ForgeService, GitService]
});
