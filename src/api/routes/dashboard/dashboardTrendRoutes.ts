import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { sql } from "drizzle-orm";
import { registerRoute } from "#shared/routing/index.js";
import {
    dashboardTrendRoute,
    dashboardVulnerabilityTrendRoute,
    dashboardStalenessTrendRoute,
    dashboardLicenseTrendRoute,
    dashboardAutoFixTrendRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

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

export function registerDashboardTrendRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

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
}
