import { sql } from "drizzle-orm";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

export interface ITeamStats {
    projectCount: number;
    vulnerabilityCount: number;
    compliantPercent: number;
    averageHealthScore: number;
}

interface IProjectCountRow {
    teamId: string;
    projectCount: number;
}

interface IVulnerabilityCountRow {
    teamId: string;
    vulnerabilityCount: number;
}

interface ILicenseComplianceRow {
    teamId: string;
    projectId: string;
    compliantCount: number;
    totalPackages: number;
}

interface IHealthScoreRow {
    teamId: string;
    projectId: string;
    score: number;
}

export function zeroStats(): ITeamStats {
    return { projectCount: 0, vulnerabilityCount: 0, compliantPercent: 100, averageHealthScore: 0 };
}

/**
 * Computes aggregate stats (project count, active vulnerability count,
 * average license compliance, average health score) for every team in one
 * batch of queries, keyed by team id. Teams with no assigned projects are
 * simply absent from every map and fall back to `zeroStats()`.
 */
export async function computeStatsByTeam(
    db: DatabaseClient.Interface["db"]
): Promise<Map<string, ITeamStats>> {
    const now = Date.now();

    const projectCountRows = await db.all<IProjectCountRow>(sql`
        SELECT team_id AS teamId, COUNT(*) AS projectCount
        FROM team_projects
        GROUP BY team_id
    `);

    const vulnerabilityCountRows = await db.all<IVulnerabilityCountRow>(sql`
        SELECT tp.team_id AS teamId, COUNT(v.id) AS vulnerabilityCount
        FROM team_projects tp
        INNER JOIN vulnerabilities v ON v.project_id = tp.project_id
            AND (
                v.dismissed_at IS NULL
                OR (v.dismissed_until IS NOT NULL AND v.dismissed_until <= ${now})
            )
        GROUP BY tp.team_id
    `);

    const licenseComplianceRows = await db.all<ILicenseComplianceRow>(sql`
        SELECT tp.team_id AS teamId, ls.project_id AS projectId,
            ls.compliant_count AS compliantCount, ls.total_packages AS totalPackages
        FROM team_projects tp
        INNER JOIN license_snapshots ls ON ls.project_id = tp.project_id
            AND ls.date = (
                SELECT MAX(ls2.date) FROM license_snapshots ls2
                WHERE ls2.project_id = tp.project_id
            )
    `);

    const healthScoreRows = await db.all<IHealthScoreRow>(sql`
        SELECT tp.team_id AS teamId, hs.project_id AS projectId, hs.score
        FROM team_projects tp
        INNER JOIN health_snapshots hs ON hs.project_id = tp.project_id
            AND hs.date = (
                SELECT MAX(hs2.date) FROM health_snapshots hs2
                WHERE hs2.project_id = tp.project_id
            )
    `);

    const projectCountByTeam = new Map(projectCountRows.map(row => [row.teamId, row.projectCount]));
    const vulnerabilityCountByTeam = new Map(
        vulnerabilityCountRows.map(row => [row.teamId, row.vulnerabilityCount])
    );

    const compliancePercentsByTeam = new Map<string, number[]>();
    for (const row of licenseComplianceRows) {
        const percent =
            row.totalPackages > 0 ? (row.compliantCount / row.totalPackages) * 100 : 100;
        const percents = compliancePercentsByTeam.get(row.teamId) ?? [];
        percents.push(percent);
        compliancePercentsByTeam.set(row.teamId, percents);
    }

    const healthScoresByTeam = new Map<string, number[]>();
    for (const row of healthScoreRows) {
        const scores = healthScoresByTeam.get(row.teamId) ?? [];
        scores.push(row.score);
        healthScoresByTeam.set(row.teamId, scores);
    }

    const teamIds = new Set<string>([
        ...projectCountByTeam.keys(),
        ...vulnerabilityCountByTeam.keys(),
        ...compliancePercentsByTeam.keys(),
        ...healthScoresByTeam.keys()
    ]);

    const statsByTeam = new Map<string, ITeamStats>();
    for (const teamId of teamIds) {
        const compliancePercents = compliancePercentsByTeam.get(teamId) ?? [];
        const healthScores = healthScoresByTeam.get(teamId) ?? [];

        statsByTeam.set(teamId, {
            projectCount: projectCountByTeam.get(teamId) ?? 0,
            vulnerabilityCount: vulnerabilityCountByTeam.get(teamId) ?? 0,
            compliantPercent:
                compliancePercents.length > 0
                    ? Math.round(
                          compliancePercents.reduce((sum, value) => sum + value, 0) /
                              compliancePercents.length
                      )
                    : 100,
            averageHealthScore:
                healthScores.length > 0
                    ? Math.round(
                          healthScores.reduce((sum, value) => sum + value, 0) / healthScores.length
                      )
                    : 0
        });
    }

    return statsByTeam;
}
