import { z } from "zod";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { PackageManagerJobExecutor as Abstraction } from "./abstractions/PackageManagerJobExecutor.js";
import { PackageManagerService } from "../PackageManager/index.js";

const packageManagerPackageSchema = z.object({
    from: z.string(),
    to: z.string()
});

class PackageManagerJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "packageManager";

    public constructor(private readonly packageManagerService: PackageManagerService.Interface) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const packages = packageManagerPackageSchema.parse(
            JSON.parse(context.packagesJson ?? "{}")
        );

        await this.packageManagerService.updateVersion(
            context.projectPath,
            context.packageManager,
            packages.to,
            context.appendLog,
            context.signal
        );
    }
}

export const PackageManagerJobExecutor = Abstraction.createImplementation({
    implementation: PackageManagerJobExecutorImpl,
    dependencies: [PackageManagerService]
});
