import { z } from "zod";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { DependencyJobExecutor as Abstraction } from "./abstractions/DependencyJobExecutor.js";
import { UpgradeService } from "../../Upgrade/index.js";

const dependencyPackagesSchema = z.array(
    z.object({
        name: z.string(),
        from: z.string(),
        to: z.string()
    })
);

class DependencyJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "dependency";

    public constructor(private readonly upgradeService: UpgradeService.Interface) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const packages = dependencyPackagesSchema.parse(JSON.parse(context.packagesJson ?? "[]"));

        for (const upgradePackage of packages) {
            await this.upgradeService.upgradePackage(
                context.projectPath,
                upgradePackage.name,
                upgradePackage.to,
                context.packageManager,
                context.appendLog,
                context.signal
            );
        }
    }
}

export const DependencyJobExecutor = Abstraction.createImplementation({
    implementation: DependencyJobExecutorImpl,
    dependencies: [UpgradeService]
});
