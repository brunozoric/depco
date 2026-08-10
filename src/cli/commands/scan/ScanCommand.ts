import { ScanCommand as Abstraction } from "./abstractions/ScanCommand.js";
import { DetectPackageManagerStep } from "./steps/DetectPackageManager/index.js";
import { LoadConfigStep } from "./steps/LoadConfig/index.js";
import { ParseLockfileStep } from "./steps/ParseLockfile/index.js";
import { CheckLicensesStep } from "./steps/CheckLicenses/index.js";
import { CheckVulnerabilitiesStep } from "./steps/CheckVulnerabilities/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

class ScanCommandImpl implements Abstraction.Interface {
    public name = "scan";
    public description = "Scan current directory for dependency issues";

    public constructor(
        private detectPackageManager: Step.Interface,
        private loadConfig: Step.Interface,
        private parseLockfile: Step.Interface,
        private checkLicenses: Step.Interface,
        private checkVulnerabilities: Step.Interface
    ) {}

    public steps(): Step.Interface[] {
        return [
            this.detectPackageManager,
            this.loadConfig,
            this.parseLockfile,
            this.checkLicenses,
            this.checkVulnerabilities
        ];
    }

    public context(argv?: Record<string, unknown>): Step.Context {
        return {
            dataDirectory: process.cwd(),
            envFilePath: "./.env",
            options: { check: argv?.["check"] ?? "license" },
            results: new Map()
        };
    }
}

export const ScanCommand = Abstraction.createImplementation({
    implementation: ScanCommandImpl,
    dependencies: [
        DetectPackageManagerStep,
        LoadConfigStep,
        ParseLockfileStep,
        CheckLicensesStep,
        CheckVulnerabilitiesStep
    ]
});
