import { writeFileSync } from "node:fs";
import { Logger } from "@webiny/stdlib";
import { RenderOutputStep as Abstraction } from "./abstractions/RenderOutputStep.js";
import { OutputFormatterFactory } from "../../formatters/abstractions/OutputFormatterFactory.js";
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { IMergedVulnerability, VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type { IPackageEntry } from "#shared/vulnerabilities/abstractions/VulnerabilityMerger.js";
import type { IDepcoConfig } from "#shared/config/types.js";
import type { EngineStatus, IEngineStatusCounts, IEnginesFinding } from "#shared/engines/types.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";
import type { ILicenseViolation, IScanOutput } from "../../formatters/types.js";

interface IApplyExitCodeInput {
    violations: ILicenseViolation[];
    vulnerabilities: IMergedVulnerability[];
    engines: IEnginesFinding[];
    config: IDepcoConfig | undefined;
}

interface IIncrementEngineStatusCountInput {
    counts: IEngineStatusCounts;
    status: EngineStatus;
}

class RenderOutputStepImpl implements Abstraction.Interface {
    public name = "render-output";
    public description = "Format and output scan results";

    public constructor(
        private readonly formatterFactory: OutputFormatterFactory.Interface,
        private readonly logger: Logger.Interface
    ) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const violations = (context.results.get("violations") as ILicenseViolation[]) ?? [];
        const vulnerabilities =
            (context.results.get("vulnerabilities") as IMergedVulnerability[]) ?? [];
        const engines = (context.results.get("engines") as IEnginesFinding[]) ?? [];
        const packages = (context.results.get("packages") as IPackageEntry[]) ?? [];
        const config = context.results.get("config") as IDepcoConfig | undefined;

        const format = (context.options["format"] as string | undefined) ?? "table";
        const formatter = this.formatterFactory.create({ format });

        const vulnerabilityCounts = this.countBySeverity(vulnerabilities);
        const engineCounts = this.countByEngineStatus(engines);

        const output: IScanOutput = {
            meta: {
                timestamp: new Date().toISOString(),
                packageCount: packages.length,
                configPath: config ? "depco.config.ts" : null
            },
            findings: { license: violations, vulnerability: vulnerabilities, engines },
            summary: {
                licenseViolations: violations.length,
                vulnerabilities: vulnerabilityCounts,
                engines: engineCounts,
                total: violations.length + vulnerabilities.length
            }
        };

        const formatted = formatter.format(output);
        const outputPath = context.options["output"] as string | undefined;

        if (outputPath) {
            writeFileSync(outputPath, this.stripAnsiCodes(formatted));
            this.logger.info(`Wrote ${output.summary.total} findings to ${outputPath}`);
        } else {
            this.logger.info(formatted);
        }

        this.applyExitCode({ violations, vulnerabilities, engines, config });

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

    private countByEngineStatus(engines: IEnginesFinding[]): IEngineStatusCounts {
        const counts: IEngineStatusCounts = {
            eol: 0,
            maintenance: 0,
            activeLts: 0,
            current: 0,
            unknown: 0
        };
        for (const finding of engines) {
            this.incrementEngineStatusCount({ counts, status: finding.status });
        }
        return counts;
    }

    private incrementEngineStatusCount(input: IIncrementEngineStatusCountInput): void {
        const { counts, status } = input;
        if (status === "active-lts") {
            counts.activeLts++;
            return;
        }
        counts[status]++;
    }

    private applyExitCode(input: IApplyExitCodeInput): void {
        if (input.violations.length > 0) {
            process.exitCode = 1;
            return;
        }

        if (input.engines.some(finding => finding.isRoot && finding.status === "eol")) {
            process.exitCode = 1;
            return;
        }

        if (this.exceedsVulnerabilityThreshold(input)) {
            process.exitCode = 1;
        }
    }

    private stripAnsiCodes(text: string): string {
        return text.replace(/\x1b\[[0-9;]*m/g, "");
    }

    private exceedsVulnerabilityThreshold(input: IApplyExitCodeInput): boolean {
        const maxSeverity = input.config?.scan?.vulnerability?.maxSeverity;
        if (!maxSeverity) {
            return false;
        }

        const thresholdIndex = VULNERABILITY_SEVERITIES.indexOf(maxSeverity);
        return input.vulnerabilities.some(
            vulnerability =>
                VULNERABILITY_SEVERITIES.indexOf(vulnerability.severity) <= thresholdIndex
        );
    }
}

export const RenderOutputStep = Abstraction.createImplementation({
    implementation: RenderOutputStepImpl,
    dependencies: [OutputFormatterFactory, Logger]
});
