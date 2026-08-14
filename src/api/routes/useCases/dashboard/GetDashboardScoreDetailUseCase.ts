import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { VULNERABILITY_PENALTY } from "#shared/vulnerabilities/types.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { GetDashboardScoreDetailUseCase as Abstraction } from "./abstractions/GetDashboardScoreDetailUseCase.js";

interface IRawOutdatedPackageRow {
    name: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: string;
}

interface IRawScoreVulnerabilityRow {
    packageName: string;
    severity: string;
    title: string;
    fixVersion: string | null;
}

class GetDashboardScoreDetailUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { projectId } = params;

            const outdatedRows = await db.all<IRawOutdatedPackageRow>(sql`
                SELECT
                    name,
                    current_version AS currentVersion,
                    latest_version AS latestVersion,
                    upgrade_type AS upgradeType
                FROM scan_results
                WHERE project_id = ${projectId}
                AND upgrade_type != 'none'
                ORDER BY
                    CASE upgrade_type
                        WHEN 'major' THEN 1
                        WHEN 'minor' THEN 2
                        WHEN 'patch' THEN 3
                    END,
                    name ASC
            `);

            const vulnerabilityRows = await db.all<IRawScoreVulnerabilityRow>(sql`
                SELECT
                    package_name AS packageName,
                    severity,
                    title,
                    fix_version AS fixVersion
                FROM vulnerabilities
                WHERE project_id = ${projectId}
                AND (dismissed_at IS NULL OR (dismissed_until IS NOT NULL AND dismissed_until <= ${Date.now()}))
                AND severity IN ('critical', 'high', 'moderate', 'low')
                ORDER BY
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'moderate' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    package_name ASC
            `);

            return Result.ok({
                outdatedPackages: outdatedRows.map(row => ({
                    name: row.name,
                    currentVersion: row.currentVersion,
                    latestVersion: row.latestVersion,
                    upgradeType: row.upgradeType as "major" | "minor" | "patch"
                })),
                vulnerabilities: vulnerabilityRows.map(row => ({
                    packageName: row.packageName,
                    severity: row.severity as "critical" | "high" | "moderate" | "low",
                    title: row.title,
                    fixVersion: row.fixVersion,
                    penalty:
                        VULNERABILITY_PENALTY[row.severity as keyof typeof VULNERABILITY_PENALTY] ??
                        0
                }))
            });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetDashboardScoreDetailUseCase = Abstraction.createImplementation({
    implementation: GetDashboardScoreDetailUseCaseImpl,
    dependencies: [DatabaseClient]
});
