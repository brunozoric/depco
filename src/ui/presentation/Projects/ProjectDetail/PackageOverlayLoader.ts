import { makeAutoObservable, runInAction } from "mobx";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import type { LicensesGateway } from "../../../features/Licenses/abstractions/LicensesGateway.js";

interface IVulnerabilityOverlay {
    count: number;
    maxSeverity: VulnerabilitySeverity;
}

interface ILicenseOverlay {
    licenseName: string;
    riskTier: string;
}

interface IPackageOverlayLoaderDependencies {
    vulnerabilitiesGateway: VulnerabilitiesGateway.Interface;
    licensesGateway: LicensesGateway.Interface;
}

export class PackageOverlayLoader {
    public vulnerabilitiesByPackage = new Map<string, IVulnerabilityOverlay>();
    public licenseByPackage = new Map<string, ILicenseOverlay>();

    private readonly vulnerabilitiesGateway: VulnerabilitiesGateway.Interface;
    private readonly licensesGateway: LicensesGateway.Interface;

    public constructor(dependencies: IPackageOverlayLoaderDependencies) {
        this.vulnerabilitiesGateway = dependencies.vulnerabilitiesGateway;
        this.licensesGateway = dependencies.licensesGateway;
        makeAutoObservable(this);
    }

    public async loadVulnerabilities(projectId: string): Promise<void> {
        try {
            const response = await this.vulnerabilitiesGateway.getByProject(projectId);
            const grouped = new Map<string, IVulnerabilityOverlay>();
            for (const vulnerability of response.items) {
                const existing = grouped.get(vulnerability.packageName);
                if (existing) {
                    existing.count++;
                    if (
                        VULNERABILITY_SEVERITIES.indexOf(vulnerability.severity) <
                        VULNERABILITY_SEVERITIES.indexOf(existing.maxSeverity)
                    ) {
                        existing.maxSeverity = vulnerability.severity;
                    }
                } else {
                    grouped.set(vulnerability.packageName, {
                        count: 1,
                        maxSeverity: vulnerability.severity
                    });
                }
            }
            runInAction(() => {
                this.vulnerabilitiesByPackage = grouped;
            });
        } catch {
            // Vulnerability fetch failure should not break the page
        }
    }

    public async loadLicenses(projectId: string): Promise<void> {
        try {
            const response = await this.licensesGateway.getByProject(projectId);
            const grouped = new Map<string, ILicenseOverlay>();
            for (const license of response.items) {
                grouped.set(license.packageName, {
                    licenseName: license.licenseName,
                    riskTier: license.riskTier
                });
            }
            runInAction(() => {
                this.licenseByPackage = grouped;
            });
        } catch {
            // License fetch failure should not break the page
        }
    }
}
