import { eq } from "drizzle-orm";
import { LicenseCheckerService as Abstraction } from "./abstractions/LicenseCheckerService.js";
import { RegistryCacheService } from "./RegistryCache/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { scanResults } from "#api/db/schema.js";

class LicenseCheckerServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly registryCacheService: RegistryCacheService.Interface,
        private readonly databaseClient: DatabaseClient.Interface
    ) {}

    public async scan({
        projectId,
        packageManager
    }: Abstraction.ScanParams): Promise<Abstraction.LicenseRecord[]> {
        const packages = await this.databaseClient.db
            .select({ name: scanResults.name, currentVersion: scanResults.currentVersion })
            .from(scanResults)
            .where(eq(scanResults.projectId, projectId))
            .all();

        const records: Abstraction.LicenseRecord[] = [];

        for (const pkg of packages) {
            try {
                const info = await this.registryCacheService.getPackageInfo(
                    pkg.name,
                    packageManager
                );

                let license = info.license;
                if (!license && pkg.currentVersion) {
                    try {
                        const versionInfo = await this.registryCacheService.getPackageInfo(
                            `${pkg.name}@${pkg.currentVersion}`,
                            packageManager
                        );
                        license = versionInfo.license;
                    } catch {}
                }

                records.push({
                    packageName: pkg.name,
                    licenseName: license ?? "UNKNOWN",
                    spdxId: license ?? null,
                    licenseUrl: info.repoUrl
                });
            } catch {
                records.push({
                    packageName: pkg.name,
                    licenseName: "UNKNOWN",
                    spdxId: null,
                    licenseUrl: null
                });
            }
        }

        return records;
    }
}

export const LicenseCheckerService = Abstraction.createImplementation({
    implementation: LicenseCheckerServiceImpl,
    dependencies: [RegistryCacheService, DatabaseClient]
});
