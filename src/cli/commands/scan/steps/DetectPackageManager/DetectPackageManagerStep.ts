import { existsSync } from "node:fs";
import { join } from "node:path";
import { DetectPackageManagerStep as Abstraction } from "./abstractions/DetectPackageManagerStep.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

interface ILockfileMapping {
    filename: string;
    packageManager: string;
}

const LOCKFILE_MAPPINGS: ILockfileMapping[] = [
    { filename: "yarn.lock", packageManager: "yarn" },
    { filename: "package-lock.json", packageManager: "npm" },
    { filename: "pnpm-lock.yaml", packageManager: "pnpm" },
    { filename: "bun.lock", packageManager: "bun" },
    { filename: "bun.lockb", packageManager: "bun" }
];

class DetectPackageManagerStepImpl implements Abstraction.Interface {
    public name = "detect-package-manager";
    public description = "Detect package manager from lockfile";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const projectPath = context.dataDirectory;

        for (const mapping of LOCKFILE_MAPPINGS) {
            if (existsSync(join(projectPath, mapping.filename))) {
                context.results.set("packageManager", mapping.packageManager);
                return { success: true, message: `Detected ${mapping.packageManager}` };
            }
        }

        return {
            success: false,
            message: "No lockfile found. Run your package manager's install command first."
        };
    }
}

export const DetectPackageManagerStep = Abstraction.createImplementation({
    implementation: DetectPackageManagerStepImpl,
    dependencies: []
});
