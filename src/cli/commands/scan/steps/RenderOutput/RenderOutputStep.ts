import { RenderOutputStep as Abstraction } from "./abstractions/RenderOutputStep.js";
import { OutputFormatterFactory } from "../../formatters/abstractions/OutputFormatterFactory.js";
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { IMergedVulnerability, VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type { IPackageEntry } from "#shared/vulnerabilities/abstractions/VulnerabilityMerger.js";
import type { IDepcoConfig } from "#shared/config/types.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";
import type { ILicenseViolation, IScanOutput } from "../../formatters/types.js";

interface IApplyExitCodeInput {
    vulnerabilities: IMergedVulnerability[];
    config: IDepcoConfig | undefined;
}

class RenderOutputStepImpl implements Abstraction.Interface {
    public name = "render-output";
    public description = "Format and output scan results";

    public constructor(private readonly formatterFactory: OutputFormatterFactory.Interface) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const violations = (context.results.get("violations") as ILicenseViolation[]) ?? [];
        const vulnerabilities =
            (context.results.get("vulnerabilities") as IMergedVulnerability[]) ?? [];
        const packages = (context.results.get("packages") as IPackageEntry[]) ?? [];
        const config = context.results.get("config") as IDepcoConfig | undefined;

        const format = (context.options["format"] as string | undefined) ?? "table";
        const formatter = this.formatterFactory.create({ format });

        const vulnerabilityCounts = this.countBySeverity(vulnerabilities);

        const output: IScanOutput = {
            meta: {
                timestamp: new Date().toISOString(),
                packageCount: packages.length,
                configPath: config ? "depco.config.ts" : null
            },
            findings: { license: violations, vulnerability: vulnerabilities },
            summary: {
                licenseViolations: violations.length,
                vulnerabilities: vulnerabilityCounts,
                total: violations.length + vulnerabilities.length
            }
        };

        console.log(formatter.format(output));

        this.applyExitCode({ vulnerabilities, config });

        return { success: true, message: `${output.summary.total} issues found` };
    }

    private countBySeverity(
        vulnerabilities: IMergedVulnerability[]
    ): Record<VulnerabilitySeverity, number> {
        const counts: Record<VulnerabilitySeverity, number> = {
            critical: 0,
            high: 0,
            moderate: 0,
            low: 0,
            info: 0
        };
        for (const vulnerability of vulnerabilities) {
            counts[vulnerability.severity]++;
        }
        return counts;
    }

    private applyExitCode(input: IApplyExitCodeInput): void {
        const maxSeverity = input.config?.scan?.vulnerability?.maxSeverity;
        if (!maxSeverity) {
            return;
        }

        const thresholdIndex = VULNERABILITY_SEVERITIES.indexOf(maxSeverity);
        const exceedsThreshold = input.vulnerabilities.some(
            vulnerability =>
                VULNERABILITY_SEVERITIES.indexOf(vulnerability.severity) <= thresholdIndex
        );

        if (exceedsThreshold) {
            process.exitCode = 1;
        }
    }
}

export const RenderOutputStep = Abstraction.createImplementation({
    implementation: RenderOutputStepImpl,
    dependencies: [OutputFormatterFactory]
});
