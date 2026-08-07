import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { registerRoute, sendList } from "#shared/routing/index.js";
import {
    dashboardHealthRoute,
    dashboardTrendRoute,
    dashboardActivityRoute,
    dashboardStalenessRoute,
    dashboardSecurityRoute,
    dashboardVulnerabilityTrendRoute,
    dashboardStalenessTrendRoute,
    dashboardLicenseTrendRoute,
    dashboardAutoFixTrendRoute,
    dashboardDependencyChangesRoute,
    dashboardScoreDetailRoute
} from "#shared/routes/index.js";
import { VULNERABILITY_PENALTY } from "#shared/vulnerabilities/types.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { dependencyChanges, projects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

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

interface IRawTrendRow {
    projectId: string;
    projectName: string;
    date: string;
    score: number;
}

interface ITrendSnapshot {
    date: string;
    score: number;
}

interface ITrendGroupItem {
    projectId: string;
    projectName: string;
    snapshots: ITrendSnapshot[];
}

interface IRawActivityRow {
    id: string;
    type: string;
    referenceId: string;
    referenceType: string;
    status: string;
    startedAt: number | null;
    completedAt: number | null;
}

interface IRawStalenessRow {
    projectId: string;
    projectName: string;
    lastScannedAt: number | null;
}

interface IRawSecurityRow {
    projectId: string;
    projectName: string;
    totalChecks: number;
    passingChecks: number;
}

interface IRawVulnerabilityTrendRow {
    date: string;
    critical: number;
    high: number;
    moderate: number;
    low: number;
}

interface IRawStalenessTrendRow {
    date: string;
    patchOutdated: number;
    minorOutdated: number;
    majorOutdated: number;
    totalPackages: number;
}

interface IRawLicenseTrendRow {
    date: string;
    compliantCount: number;
    deniedCount: number;
    warnedCount: number;
    totalPackages: number;
}

interface IRawAutoFixTrendRow {
    date: string;
    pending: number;
    created: number;
    merged: number;
    closed: number;
    failed: number;
}

interface ICountRow {
    count: number;
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

const RANGE_DAYS: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90
};

function daysToCutoff(days: string | undefined): string | undefined {
    if (!days) {
        return undefined;
    }
    const cutoff = new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10);
    return cutoff;
}

export async function dashboardRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, dashboardHealthRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId
            ? sql`AND hs.project_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
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

    registerRoute(app, dashboardTrendRoute, {}, async (request, reply) => {
        const range = request.query.range ?? "30d";
        const { teamId } = request.query;
        const days = RANGE_DAYS[range];

        const modifier = `-${days} days`;
        const dateFilter = days ? sql`AND hs.date >= DATE('now', ${modifier})` : sql``;
        const teamCondition = teamId
            ? sql`AND hs.project_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawTrendRow>(sql`
            SELECT
                hs.project_id AS projectId,
                p.name AS projectName,
                hs.date,
                hs.score
            FROM health_snapshots hs
            INNER JOIN projects p ON hs.project_id = p.id
            WHERE 1=1 ${dateFilter} ${teamCondition}
            ORDER BY p.name ASC, hs.date ASC
        `);

        const grouped = new Map<string, ITrendGroupItem>();
        for (const row of rows) {
            let entry = grouped.get(row.projectId);
            if (!entry) {
                entry = { projectId: row.projectId, projectName: row.projectName, snapshots: [] };
                grouped.set(row.projectId, entry);
            }
            entry.snapshots.push({ date: row.date, score: row.score });
        }

        reply.send({ items: Array.from(grouped.values()) });
    });

    registerRoute(app, dashboardActivityRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId
            ? sql`WHERE reference_type = 'project' AND reference_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawActivityRow>(sql`
            SELECT
                id, type, reference_id AS referenceId, reference_type AS referenceType,
                status, started_at AS startedAt, completed_at AS completedAt
            FROM upgrade_jobs
            ${teamCondition}
            ORDER BY started_at DESC
            LIMIT 20
        `);

        reply.send({ items: rows });
    });

    registerRoute(app, dashboardStalenessRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId
            ? sql`WHERE id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawStalenessRow>(sql`
            SELECT
                id AS projectId,
                name AS projectName,
                last_scanned_at AS lastScannedAt
            FROM projects
            ${teamCondition}
            ORDER BY
                CASE WHEN last_scanned_at IS NULL THEN 0 ELSE 1 END ASC,
                last_scanned_at ASC
        `);

        reply.send({ items: rows });
    });

    registerRoute(app, dashboardSecurityRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        const teamCondition = teamId
            ? sql`AND sc.project_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawSecurityRow>(sql`
            SELECT
                sc.project_id AS projectId,
                p.name AS projectName,
                json_array_length(sc.results) AS totalChecks,
                sc.passes AS passingChecks
            FROM security_checks sc
            INNER JOIN projects p ON sc.project_id = p.id
            WHERE sc.checked_at = (
                SELECT MAX(sc2.checked_at)
                FROM security_checks sc2
                WHERE sc2.project_id = sc.project_id
            )
            ${teamCondition}
            ORDER BY
                CASE WHEN json_array_length(sc.results) = 0 THEN 2
                ELSE CAST(sc.passes AS REAL) / json_array_length(sc.results) END ASC
        `);

        reply.send({ items: rows });
    });

    registerRoute(app, dashboardVulnerabilityTrendRoute, {}, async (request, reply) => {
        const { days, teamId } = request.query;
        const dateFilter = daysToCutoff(days);
        const dateCondition = dateFilter ? sql`AND date >= ${dateFilter}` : sql``;
        const teamCondition = teamId
            ? sql`AND project_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawVulnerabilityTrendRow>(sql`
            SELECT
                date,
                SUM(vuln_critical) AS critical,
                SUM(vuln_high) AS high,
                SUM(vuln_moderate) AS moderate,
                SUM(vuln_low) AS low
            FROM health_snapshots
            WHERE 1=1 ${dateCondition} ${teamCondition}
            GROUP BY date
            ORDER BY date ASC
        `);

        reply.send({ points: rows });
    });

    registerRoute(app, dashboardStalenessTrendRoute, {}, async (request, reply) => {
        const { days, teamId } = request.query;
        const dateFilter = daysToCutoff(days);
        const dateCondition = dateFilter ? sql`AND date >= ${dateFilter}` : sql``;
        const teamCondition = teamId
            ? sql`AND project_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawStalenessTrendRow>(sql`
            SELECT
                date,
                SUM(patch_outdated) AS patchOutdated,
                SUM(minor_outdated) AS minorOutdated,
                SUM(major_outdated) AS majorOutdated,
                SUM(total_packages) AS totalPackages
            FROM health_snapshots
            WHERE 1=1 ${dateCondition} ${teamCondition}
            GROUP BY date
            ORDER BY date ASC
        `);

        reply.send({ points: rows });
    });

    registerRoute(app, dashboardLicenseTrendRoute, {}, async (request, reply) => {
        const { days, teamId } = request.query;
        const dateFilter = daysToCutoff(days);
        const dateCondition = dateFilter ? sql`AND date >= ${dateFilter}` : sql``;
        const teamCondition = teamId
            ? sql`AND project_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawLicenseTrendRow>(sql`
            SELECT
                date,
                SUM(compliant_count) AS compliantCount,
                SUM(denied_count) AS deniedCount,
                SUM(warned_count) AS warnedCount,
                SUM(total_packages) AS totalPackages
            FROM license_snapshots
            WHERE 1=1 ${dateCondition} ${teamCondition}
            GROUP BY date
            ORDER BY date ASC
        `);

        reply.send({ points: rows });
    });

    registerRoute(app, dashboardAutoFixTrendRoute, {}, async (request, reply) => {
        const { days, teamId } = request.query;
        const dateFilter = daysToCutoff(days);
        const dateCondition = dateFilter
            ? sql`AND DATE(updated_at/1000, 'unixepoch') >= ${dateFilter}`
            : sql``;
        const teamCondition = teamId
            ? sql`AND project_id IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            : sql``;

        const rows = await db.all<IRawAutoFixTrendRow>(sql`
            SELECT
                DATE(updated_at/1000, 'unixepoch') AS date,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'created' THEN 1 ELSE 0 END) AS created,
                SUM(CASE WHEN status = 'merged' THEN 1 ELSE 0 END) AS merged,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
            FROM auto_fix_pull_requests
            WHERE 1=1 ${dateCondition} ${teamCondition}
            GROUP BY DATE(updated_at/1000, 'unixepoch')
            ORDER BY date ASC
        `);

        reply.send({ points: rows });
    });

    registerRoute(app, dashboardDependencyChangesRoute, {}, async (request, reply) => {
        const { projectId, limit, teamId } = request.query;

        const conditions: SQL[] = [];
        if (projectId) {
            conditions.push(eq(dependencyChanges.projectId, projectId));
        }
        if (teamId) {
            conditions.push(
                sql`${dependencyChanges.projectId} IN (SELECT project_id FROM team_projects WHERE team_id = ${teamId})`
            );
        }
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const [items, countResult] = await Promise.all([
            db
                .select({
                    id: dependencyChanges.id,
                    projectId: dependencyChanges.projectId,
                    projectName: projects.name,
                    packageName: dependencyChanges.packageName,
                    changeType: dependencyChanges.changeType,
                    previousVersion: dependencyChanges.previousVersion,
                    newVersion: dependencyChanges.newVersion,
                    detectedAt: dependencyChanges.detectedAt
                })
                .from(dependencyChanges)
                .innerJoin(projects, eq(dependencyChanges.projectId, projects.id))
                .where(where)
                .orderBy(sql`${dependencyChanges.detectedAt} DESC`)
                .limit(limit)
                .all(),
            db
                .select({ count: sql<number>`COUNT(*)` })
                .from(dependencyChanges)
                .where(where)
                .get() as ICountRow | undefined
        ]);

        sendList(reply, items, countResult?.count ?? 0);
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
