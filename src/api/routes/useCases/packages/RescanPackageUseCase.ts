import { eq, sql } from "drizzle-orm";
import semver from "semver";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { scanResults } from "#api/db/schema.js";
import { RescanPackageUseCase as Abstraction } from "./abstractions/RescanPackageUseCase.js";

function resolveUpgradeType(currentVersion: string, latestVersion: string): string {
    if (currentVersion === latestVersion) {
        return "none";
    }

    const diff = semver.diff(currentVersion, latestVersion);
    if (!diff || !semver.gt(latestVersion, currentVersion)) {
        return "none";
    }
    if (diff === "major" || diff === "premajor") {
        return "major";
    }
    if (diff === "minor" || diff === "preminor") {
        return "minor";
    }
    return "patch";
}

class RescanPackageUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly registryCacheService: RegistryCacheService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const rows = await db
                .select()
                .from(scanResults)
                .where(eq(scanResults.name, params.packageName))
                .all();

            if (rows.length === 0) {
                return Result.ok({ updated: 0 });
            }

            const packageManager =
                (
                    await db.all<{ package_manager: string }>(
                        sql`SELECT p.package_manager FROM projects p
                            JOIN scan_results sr ON sr.project_id = p.id
                            WHERE sr.name = ${params.packageName} LIMIT 1`
                    )
                )[0]?.package_manager ?? "npm";

            const info = await this.registryCacheService.getPackageInfo(
                params.packageName,
                packageManager,
                true
            );

            let updated = 0;
            for (const row of rows) {
                const resolvedLatest =
                    semver.valid(info.latestVersion) &&
                    semver.valid(row.currentVersion) &&
                    semver.lt(info.latestVersion, row.currentVersion)
                        ? row.currentVersion
                        : info.latestVersion;

                const upgradeType = resolveUpgradeType(row.currentVersion, resolvedLatest);

                await db
                    .update(scanResults)
                    .set({
                        latestVersion: resolvedLatest,
                        upgradeType,
                        scannedAt: Date.now()
                    })
                    .where(eq(scanResults.id, row.id))
                    .run();
                updated++;
            }

            return Result.ok({ updated });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const RescanPackageUseCase = Abstraction.createImplementation({
    implementation: RescanPackageUseCaseImpl,
    dependencies: [DatabaseClient, RegistryCacheService]
});
