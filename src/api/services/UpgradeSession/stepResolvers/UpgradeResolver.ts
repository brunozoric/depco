import type { IStepExecuteParams, IStepResult } from "./abstractions/StepResolver.js";
import { getNextStep } from "./stepUtils.js";
import { StepResolver as StepResolverAbstraction } from "./abstractions/StepResolver.js";
import { UpgradeService } from "../../Upgrade/index.js";

interface ISelectedPackage {
    name: string;
    targetVersion: string;
}

class UpgradeResolverImpl implements StepResolverAbstraction.Interface {
    public readonly type = "upgrade";
    public readonly required = true;

    public constructor(private readonly upgradeService: UpgradeService.Interface) {}

    public async execute(params: IStepExecuteParams): Promise<IStepResult> {
        const { projectPath, context, input, onProgress } = params;
        const selectPackagesStep = context.steps.find(step => step.type === "select-packages");
        const packages = (selectPackagesStep?.input["packages"] ?? []) as ISelectedPackage[];

        if (!Array.isArray(packages) || packages.length === 0) {
            throw new Error("No packages selected");
        }

        const upgraded: string[] = [];
        let logs = "";
        const onLog = (line: string): void => {
            logs += line;
            onProgress?.(line);
        };

        for (const packageToUpgrade of packages) {
            await this.upgradeService.upgradePackage(
                projectPath,
                packageToUpgrade.name,
                packageToUpgrade.targetVersion,
                context.packageManager,
                onLog
            );
            upgraded.push(packageToUpgrade.name);
        }

        return {
            updatedStep: {
                type: this.type,
                status: "completed",
                input,
                result: { upgraded, logs }
            },
            nextStep: getNextStep(this.type, context.stepOrder)
        };
    }
}

export const UpgradeResolver = StepResolverAbstraction.createImplementation({
    implementation: UpgradeResolverImpl,
    dependencies: [UpgradeService]
});
