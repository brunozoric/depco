import {
    type IStepExecuteParams,
    type IStepResult,
    StepResolver as StepResolverAbstraction
} from "./abstractions/StepResolver.js";
import { getNextStep } from "./abstractions/StepResolver.js";

class SelectPackagesResolverImpl implements StepResolverAbstraction.Interface {
    public readonly type = "select-packages";
    public readonly required = true;

    public async execute(params: IStepExecuteParams): Promise<IStepResult> {
        const { context, input } = params;
        const packages = input["packages"];
        if (!Array.isArray(packages) || packages.length === 0) {
            throw new Error("packages must be a non-empty array");
        }

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { packageCount: packages.length }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }
}

export const SelectPackagesResolver = StepResolverAbstraction.createImplementation({
    implementation: SelectPackagesResolverImpl,
    dependencies: []
});
