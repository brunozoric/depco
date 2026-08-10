import { CheckLicensesStep as Abstraction } from "./abstractions/CheckLicensesStep.js";
import { classifyLicenseRiskTier } from "#shared/licenses/types.js";
import type { LicenseRiskTier } from "#shared/licenses/types.js";
import type { IDepcoConfig } from "#shared/config/types.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

interface IPackageEntry {
    name: string;
    version: string;
}

interface ILicenseResult {
    packageName: string;
    version: string;
    license: string;
    riskTier: LicenseRiskTier;
}

const CONCURRENCY = 10;

function normalizeLicenseField(rawLicense: unknown): string {
    if (typeof rawLicense === "string") {
        return rawLicense;
    }

    if (rawLicense && typeof rawLicense === "object" && "type" in rawLicense) {
        const legacyType = (rawLicense as Record<string, unknown>)["type"];
        if (typeof legacyType === "string") {
            return legacyType;
        }
    }

    return "UNKNOWN";
}

async function fetchLicense(args: {
    packageEntry: IPackageEntry;
    registryUrl: string;
}): Promise<ILicenseResult> {
    const { packageEntry, registryUrl } = args;
    try {
        const response = await fetch(`${registryUrl}/${packageEntry.name}/${packageEntry.version}`);
        if (!response.ok) {
            return {
                packageName: packageEntry.name,
                version: packageEntry.version,
                license: "UNKNOWN",
                riskTier: "unknown"
            };
        }
        const data = (await response.json()) as Record<string, unknown>;
        const license = normalizeLicenseField(data["license"]);
        return {
            packageName: packageEntry.name,
            version: packageEntry.version,
            license,
            riskTier: classifyLicenseRiskTier(license)
        };
    } catch {
        return {
            packageName: packageEntry.name,
            version: packageEntry.version,
            license: "UNKNOWN",
            riskTier: "unknown"
        };
    }
}

async function fetchInBatches(args: {
    packages: IPackageEntry[];
    registryUrl: string;
}): Promise<ILicenseResult[]> {
    const { packages, registryUrl } = args;
    const results: ILicenseResult[] = [];
    for (let i = 0; i < packages.length; i += CONCURRENCY) {
        const batch = packages.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(packageEntry => fetchLicense({ packageEntry, registryUrl }))
        );
        results.push(...batchResults);
    }
    return results;
}

class CheckLicensesStepImpl implements Abstraction.Interface {
    public name = "check-licenses";
    public description = "Check package licenses";

    public async execute(context: IStepContext): Promise<IStepResult> {
        const packages = context.results.get("packages") as IPackageEntry[];
        const config = (context.results.get("config") as IDepcoConfig | undefined) ?? {};
        const allowedTiers = config.scan?.license?.allowedRiskTiers ?? ["permissive"];
        const licenseIgnored = config.scan?.license?.ignoredPackages ?? [];
        const globalIgnored = config.scan?.ignoredPackages ?? [];
        const allIgnored = new Set([...licenseIgnored, ...globalIgnored]);
        const registryUrl = config.scan?.registryUrl ?? "https://registry.npmjs.org";

        const results = await fetchInBatches({ packages, registryUrl });
        const violations = results.filter(
            result => !allIgnored.has(result.packageName) && !allowedTiers.includes(result.riskTier)
        );

        context.results.set("violations", violations);

        if (violations.length === 0) {
            return {
                success: true,
                message: `All ${results.length} packages have permissive licenses`
            };
        }

        return { success: true, message: `Found ${violations.length} violation(s)` };
    }
}

export const CheckLicensesStep = Abstraction.createImplementation({
    implementation: CheckLicensesStepImpl,
    dependencies: []
});
