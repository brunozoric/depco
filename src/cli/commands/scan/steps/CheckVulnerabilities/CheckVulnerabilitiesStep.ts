import { execSync } from "node:child_process";
import { CheckVulnerabilitiesStep as Abstraction } from "./abstractions/CheckVulnerabilitiesStep.js";
import { AuditParserService } from "#shared/vulnerabilities/abstractions/AuditParserService.js";
import { OsvQueryService } from "#shared/vulnerabilities/abstractions/OsvQueryService.js";
import type { IOsvAdvisory } from "#shared/vulnerabilities/abstractions/OsvQueryService.js";
import { VulnerabilityMerger } from "#shared/vulnerabilities/abstractions/VulnerabilityMerger.js";
import type { IPackageEntry } from "#shared/vulnerabilities/abstractions/VulnerabilityMerger.js";
import type { IAuditRecord, IMergedVulnerability } from "#shared/vulnerabilities/types.js";
import type { IDepcoConfig } from "#shared/config/types.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

const AUDIT_COMMAND_BY_PACKAGE_MANAGER: Record<string, string> = {
    npm: "npm audit --json",
    yarn: "yarn audit --json",
    pnpm: "pnpm audit --json",
    bun: "bun audit --json"
};

function getAuditCommand(packageManager: string): string {
    return AUDIT_COMMAND_BY_PACKAGE_MANAGER[packageManager] ?? "npm audit --json";
}

interface IRunAuditInput {
    packageManager: string;
    dataDirectory: string;
}

interface IRunAuditResult {
    auditRecords: IAuditRecord[];
    auditFailed: boolean;
}

interface IQueryOsvResult {
    osvAdvisories: Map<string, IOsvAdvisory[]>;
    osvFailed: boolean;
}

interface IFilterIgnoredPackagesInput {
    vulnerabilities: IMergedVulnerability[];
    config: IDepcoConfig;
}

class CheckVulnerabilitiesStepImpl implements Abstraction.Interface {
    public name = "check-vulnerabilities";
    public description = "Check packages for known vulnerabilities";

    public constructor(
        private readonly auditParser: AuditParserService.Interface,
        private readonly osvQuery: OsvQueryService.Interface,
        private readonly merger: VulnerabilityMerger.Interface
    ) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const check = context.options["check"] as string | undefined;
        if (check !== "vulnerability" && check !== "all") {
            return { success: true, skipped: true, message: "vulnerability check not requested" };
        }

        const packages = context.results.get("packages") as IPackageEntry[];
        const config = (context.results.get("config") as IDepcoConfig | undefined) ?? {};
        const packageManager = context.results.get("packageManager") as string;

        console.log(`\nChecking ${packages.length} packages for vulnerabilities...\n`);

        const { auditRecords, auditFailed } = this.runAudit({
            packageManager,
            dataDirectory: context.dataDirectory
        });
        const { osvAdvisories, osvFailed } = await this.queryOsv(packages);

        if (auditFailed && osvFailed) {
            return { success: false, message: "Both audit and OSV queries failed" };
        }

        const merged = this.merger.merge({ auditRecords, osvAdvisories, packages });
        const filtered = this.filterIgnoredPackages({ vulnerabilities: merged, config });

        context.results.set("vulnerabilities", filtered);

        return {
            success: true,
            message: `Found ${filtered.length} vulnerabilit${filtered.length === 1 ? "y" : "ies"}`
        };
    }

    private runAudit(input: IRunAuditInput): IRunAuditResult {
        try {
            const output = execSync(getAuditCommand(input.packageManager), {
                cwd: input.dataDirectory,
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "pipe"]
            });
            const auditRecords = this.auditParser.parse({
                jsonOutput: output,
                packageManager: input.packageManager
            });
            return { auditRecords, auditFailed: false };
        } catch {
            console.warn("Audit command failed, continuing with OSV only");
            return { auditRecords: [], auditFailed: true };
        }
    }

    private async queryOsv(packages: IPackageEntry[]): Promise<IQueryOsvResult> {
        try {
            const osvAdvisories = await this.osvQuery.queryBatch({ packages });
            return { osvAdvisories, osvFailed: false };
        } catch {
            console.warn("OSV query failed, continuing with audit only");
            return { osvAdvisories: new Map(), osvFailed: true };
        }
    }

    private filterIgnoredPackages(input: IFilterIgnoredPackagesInput): IMergedVulnerability[] {
        const ignoredPackages = new Set([
            ...(input.config.scan?.vulnerability?.ignoredPackages ?? []),
            ...(input.config.scan?.ignoredPackages ?? [])
        ]);
        return input.vulnerabilities.filter(
            vulnerability => !ignoredPackages.has(vulnerability.packageName)
        );
    }
}

export const CheckVulnerabilitiesStep = Abstraction.createImplementation({
    implementation: CheckVulnerabilitiesStepImpl,
    dependencies: [AuditParserService, OsvQueryService, VulnerabilityMerger]
});
