import type { IStepExecuteParams, IStepResult } from "./abstractions/StepResolver.js";
import { StepResolver as StepResolverAbstraction } from "./abstractions/StepResolver.js";
import { getNextStep } from "./abstractions/StepResolver.js";
import { UpgradeService } from "../Upgrade/index.js";

class RefreshTransientResolverImpl implements StepResolverAbstraction.Interface {
    public readonly type = "refresh-transient";
    public readonly required = false;

    public constructor(private readonly upgradeService: UpgradeService.Interface) {}

    public async execute(params: IStepExecuteParams): Promise<IStepResult> {
        const { projectPath, context, input, onProgress } = params;
        const refresh = input["refresh"] === true;

        if (!refresh) {
            return {
                updatedStep: {
                    type: this.type,
                    status: "skipped",
                    input,
                    result: { refreshed: false, logs: "" }
                },
                nextStep: getNextStep(this.type, context.stepOrder)
            };
        }

        let logs = "";
        const onLog = (line: string): void => {
            logs += line;
            onProgress?.(line);
        };

        await this.upgradeService.refreshTransient(projectPath, context.packageManager, onLog);

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { refreshed: true, logs }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }
}

export const RefreshTransientResolver = StepResolverAbstraction.createImplementation({
    implementation: RefreshTransientResolverImpl,
    dependencies: [UpgradeService]
});
