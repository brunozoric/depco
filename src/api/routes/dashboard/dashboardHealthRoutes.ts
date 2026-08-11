import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { sql } from "drizzle-orm";
import { registerRoute } from "#shared/routing/index.js";
import { dashboardHealthRoute, dashboardScoreDetailRoute } from "#shared/routes/index.js";
import { VULNERABILITY_PENALTY } from "#shared/vulnerabilities/types.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";

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

export function registerDashboardHealthRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, dashboardHealthRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId ? sql`AND hs.project_id IN ${teamProjectIds(teamId)}` : sql``;

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

        const projectList = rows.map(row => ({
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

        const worstProject =
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

        reply.send({
            summary: { totalProjects, averageScore, worstProject },
            projects: projectList
        });
    });

    registerRoute(app, dashboardScoreDetailRoute, {}, async (request, reply) => {
        const { projectId } = request.params;

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

        reply.send({
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
                    VULNERABILITY_PENALTY[row.severity as keyof typeof VULNERABILITY_PENALTY] ?? 0
            }))
        });
    });
}
