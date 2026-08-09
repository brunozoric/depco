import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { TransientJobExecutor as Abstraction } from "./abstractions/TransientJobExecutor.js";
import { UpgradeService } from "../../Upgrade/index.js";

const VALID_PACKAGE_NAME = /^(@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i;

class TransientJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "transient";

    public constructor(private readonly upgradeService: UpgradeService.Interface) {}

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        let packageNames: string[] | undefined;
        if (context.packagesJson) {
            try {
                const parsed = JSON.parse(context.packagesJson) as string[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    packageNames = parsed.filter(
                        name => typeof name === "string" && VALID_PACKAGE_NAME.test(name)
                    );
                    if (packageNames.length === 0) {
                        packageNames = undefined;
                    }
                }
            } catch {
                // fall through — refresh all
            }
        }

        await this.upgradeService.refreshTransient(
            context.projectPath,
            context.packageManager,
            context.appendLog,
            context.signal,
            packageNames
        );
    }
}

export const TransientJobExecutor = Abstraction.createImplementation({
    implementation: TransientJobExecutorImpl,
    dependencies: [UpgradeService]
});
