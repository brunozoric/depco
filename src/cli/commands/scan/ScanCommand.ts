import { ScanCommand as Abstraction } from "./abstractions/ScanCommand.js";
import { DetectPackageManagerStep } from "./steps/DetectPackageManager/index.js";
import { ParseLockfileStep } from "./steps/ParseLockfile/index.js";
import { CheckLicensesStep } from "./steps/CheckLicenses/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

class ScanCommandImpl implements Abstraction.Interface {
    public name = "scan";
    public description = "Scan current directory for dependency issues";

    public constructor(
        private detectPackageManager: Step.Interface,
        private parseLockfile: Step.Interface,
        private checkLicenses: Step.Interface
    ) {}

    public steps(): Step.Interface[] {
        return [this.detectPackageManager, this.parseLockfile, this.checkLicenses];
    }

    public context(): Step.Context {
        return {
            dataDirectory: process.cwd(),
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
    }
}

export const ScanCommand = Abstraction.createImplementation({
    implementation: ScanCommandImpl,
    dependencies: [DetectPackageManagerStep, ParseLockfileStep, CheckLicensesStep]
});
