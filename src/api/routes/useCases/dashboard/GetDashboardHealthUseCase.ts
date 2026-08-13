import { sql } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { GetDashboardHealthUseCase as Abstraction } from "./abstractions/GetDashboardHealthUseCase.js";

interface IRawHealthRow {
    projectId: string;
    projectName: string;
    score: number;
    totalPackages: number;
    upToDate: number;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
    lastScannedAt: number | null;
    prevScore: number | null;
    vulnerabilityCritical: number;
    vulnerabilityHigh: number;
    vulnerabilityModerate: number;
    vulnerabilityLow: number;
}

class GetDashboardHealthUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { teamId } = params;
            const teamCondition = teamId
                ? sql`AND hs.project_id IN ${teamProjectIds(teamId)}`
                : sql``;

            const rows = await db.all<IRawHealthRow>(sql`
                SELECT
                    hs.project_id AS projectId,
                    p.name AS projectName,
                    hs.score,
                    hs.total_packages AS totalPackages,
                    hs.up_to_date AS upToDate,
                    hs.patch_outdated AS patchOutdated,
                    hs.minor_outdated AS minorOutdated,
                    hs.major_outdated AS majorOutdated,
                    p.last_scanned_at AS lastScannedAt,
                    prev.score AS prevScore,
                    hs.vuln_critical AS vulnerabilityCritical,
                    hs.vuln_high AS vulnerabilityHigh,
                    hs.vuln_moderate AS vulnerabilityModerate,
                    hs.vuln_low AS vulnerabilityLow
                FROM health_snapshots hs
                INNER JOIN projects p ON hs.project_id = p.id
                LEFT JOIN health_snapshots prev ON prev.project_id = hs.project_id
                    AND prev.date = (
                        SELECT MAX(h2.date) FROM health_snapshots h2
                        WHERE h2.project_id = hs.project_id
                        AND h2.date <= DATE(hs.date, '-7 days')
                    )
                WHERE hs.date = (
                    SELECT MAX(h3.date) FROM health_snapshots h3
                    WHERE h3.project_id = hs.project_id
                )
                ${teamCondition}
                ORDER BY hs.score ASC
            `);

            const projectList: Abstraction.Project[] = rows.map(row => ({
                projectId: row.projectId,
                projectName: row.projectName,
                score: row.score,
                scoreDelta: row.prevScore !== null ? row.score - row.prevScore : null,
                totalPackages: row.totalPackages,
                upToDate: row.upToDate,
                patchOutdated: row.patchOutdated,
                minorOutdated: row.minorOutdated,
                majorOutdated: row.majorOutdated,
                lastScannedAt: row.lastScannedAt,
                vulnerabilityCritical: row.vulnerabilityCritical,
                vulnerabilityHigh: row.vulnerabilityHigh,
                vulnerabilityModerate: row.vulnerabilityModerate,
                vulnerabilityLow: row.vulnerabilityLow
            }));

            const totalProjects = projectList.length;

            const averageScore =
                totalProjects > 0
                    ? Math.round(projectList.reduce((sum, p) => sum + p.score, 0) / totalProjects)
                    : 0;

            const worstProject: Abstraction.WorstProject | null =
                projectList.length > 0
                    ? {
                          id: projectList[0]!.projectId,
                          name: projectList[0]!.projectName,
                          score: projectList[0]!.score,
                          totalPackages: projectList[0]!.totalPackages,
                          upToDate: projectList[0]!.upToDate,
                          patchOutdated: projectList[0]!.patchOutdated,
                          minorOutdated: projectList[0]!.minorOutdated,
                          majorOutdated: projectList[0]!.majorOutdated
                      }
                    : null;

            return Result.ok({
                summary: { totalProjects, averageScore, worstProject },
                projects: projectList
            });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetDashboardHealthUseCase = Abstraction.createImplementation({
    implementation: GetDashboardHealthUseCaseImpl,
    dependencies: [DatabaseClient]
});
