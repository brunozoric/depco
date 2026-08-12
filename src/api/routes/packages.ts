import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import semver from "semver";
import { eq, sql, type SQL } from "drizzle-orm";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listPackagesRoute,
    rescanPackageRoute,
    getPackageDetailRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { RegistryCacheService } from "../services/RegistryCache/index.js";
import { scanResults, dependencies } from "#api/db/schema.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IRawPackageRow {
    name: string;
    projects: string;
    resolvedChangelogCount: number;
    totalChangelogCount: number;
    lastPublishedAt: number | null;
    dependencyKind: string;
    registryResolved: number;
}

interface IPackageProject {
    projectId: string;
    projectName: string;
    currentVersion: string;
    latestVersion: string | null;
    upgradeType: string | null;
}

interface IPackageListItem {
    name: string;
    projects: IPackageProject[];
    resolvedChangelogCount: number;
    totalChangelogCount: number;
    lastPublishedAt: number | null;
    dependencyKind: string;
    registryResolved: boolean;
}

interface IRawCountRow {
    cnt: number;
}

interface IPackageDetailScanRow {
    projectId: string;
    projectName: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: string;
    dependencyKind: string;
}

interface IPackageDetailVersionRow {
    latestVersion: string;
    lastPublishedAt: number | null;
}

const DEFAULT_PAGE_SIZE = 50;

export async function packagesRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, listPackagesRoute, {}, async (request, reply) => {
        const {
            search,
            upgradeType,
            dependencyKind,
            projectId,
            hasChangelog,
            page = 1,
            pageSize = DEFAULT_PAGE_SIZE,
            sortBy = "name",
            sortOrder = "asc",
            teamId
        } = request.query;

        const conditions: SQL[] = [];
        if (search) {
            conditions.push(sql`sr.name LIKE ${`%${search}%`}`);
        }
        if (upgradeType) {
            conditions.push(sql`sr.upgrade_type = ${upgradeType}`);
        }
        if (dependencyKind && dependencyKind !== "all") {
            conditions.push(sql`sr.dependency_kind = ${dependencyKind}`);
        }
        if (projectId) {
            conditions.push(sql`sr.project_id = ${projectId}`);
        }
        if (teamId) {
            conditions.push(sql`sr.project_id IN ${teamProjectIds(teamId)}`);
        }

        const whereClause =
            conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

        const havingClause = hasChangelog === "true" ? sql`HAVING totalChangelogCount > 0` : sql``;

        const orderColumn = sortBy === "lastPublishedAt" ? sql`lastPublishedAt` : sql`sr.name`;
        const orderDir = sortOrder === "desc" ? sql`DESC` : sql`ASC`;
        const orderClause = sql`ORDER BY ${orderColumn} ${orderDir}`;

        const offset = (page - 1) * pageSize;

        const countQuery = sql`
            SELECT COUNT(*) AS cnt FROM (
                SELECT sr.name, COALESCE(cl.total_cnt, 0) AS totalChangelogCount
                FROM scan_results sr
                JOIN projects p ON sr.project_id = p.id
                LEFT JOIN (
                    SELECT d.name AS dep_name,
                        COUNT(*) AS total_cnt,
                        COUNT(CASE WHEN c.content IS NOT NULL AND c.content != '' AND c.source != 'none' THEN 1 END) AS resolved_cnt
                    FROM changelogs c
                    JOIN dependencies d ON c.dependency_id = d.id
                    GROUP BY d.name
                ) cl ON cl.dep_name = sr.name
                ${whereClause}
                GROUP BY sr.name
                ${havingClause}
            )
        `;

        const dataQuery = sql`
            SELECT
                sr.name AS name,
                json_group_array(
                    json_object(
                        'projectId', sr.project_id,
                        'projectName', p.name,
                        'currentVersion', sr.current_version,
                        'latestVersion', sr.latest_version,
                        'upgradeType', sr.upgrade_type
                    )
                ) AS projects,
                COALESCE(cl.resolved_cnt, 0) AS resolvedChangelogCount,
                COALESCE(cl.total_cnt, 0) AS totalChangelogCount,
                dv_latest.max_published_at AS lastPublishedAt,
                MIN(sr.dependency_kind) AS dependencyKind,
                MIN(sr.registry_resolved) AS registryResolved
            FROM scan_results sr
            JOIN projects p ON sr.project_id = p.id
            LEFT JOIN (
                SELECT d.name AS dep_name,
                    COUNT(*) AS total_cnt,
                    COUNT(CASE WHEN c.content IS NOT NULL AND c.content != '' AND c.source != 'none' THEN 1 END) AS resolved_cnt
                FROM changelogs c
                JOIN dependencies d ON c.dependency_id = d.id
                GROUP BY d.name
            ) cl ON cl.dep_name = sr.name
            LEFT JOIN (
                SELECT d.name AS dep_name, MAX(dv.published_at) AS max_published_at
                FROM dependency_versions dv
                JOIN dependencies d ON dv.dependency_id = d.id
                GROUP BY d.name
            ) dv_latest ON dv_latest.dep_name = sr.name
            ${whereClause}
            GROUP BY sr.name
            ${havingClause}
            ${orderClause}
            LIMIT ${pageSize} OFFSET ${offset}
        `;

        const [countRows, rawRows] = await Promise.all([
            db.all<IRawCountRow>(countQuery),
            db.all<IRawPackageRow>(dataQuery)
        ]);

        const total = countRows[0]?.cnt ?? 0;

        const items: IPackageListItem[] = rawRows.map(row => ({
            name: row.name,
            projects: JSON.parse(row.projects) as IPackageProject[],
            resolvedChangelogCount: row.resolvedChangelogCount ?? 0,
            totalChangelogCount: row.totalChangelogCount ?? 0,
            lastPublishedAt: row.lastPublishedAt ?? null,
            dependencyKind: row.dependencyKind,
            registryResolved: row.registryResolved === 1
        }));

        reply.send({ items, total });
    });

    registerRoute(app, getPackageDetailRoute, {}, async (request, reply) => {
        const { packageName } = request.params;

        const scanRows = await db.all<IPackageDetailScanRow>(sql`
            SELECT sr.project_id AS projectId, p.name AS projectName,
                   sr.current_version AS currentVersion, sr.latest_version AS latestVersion,
                   sr.upgrade_type AS upgradeType, sr.dependency_kind AS dependencyKind
            FROM scan_results sr
            JOIN projects p ON sr.project_id = p.id
            WHERE sr.name = ${packageName}
        `);

        if (scanRows.length === 0) {
            sendError({ reply, statusCode: 404, message: "Package not found" });
            return;
        }

        const depRow = await db
            .select({ repoUrl: dependencies.repoUrl })
            .from(dependencies)
            .where(eq(dependencies.name, packageName))
            .get();

        const versionRow = await db.get<IPackageDetailVersionRow>(sql`
            SELECT dv.version AS latestVersion, dv.published_at AS lastPublishedAt
            FROM dependency_versions dv
            JOIN dependencies d ON dv.dependency_id = d.id
            WHERE d.name = ${packageName}
            ORDER BY dv.published_at DESC
            LIMIT 1
        `);

        sendOne({
            reply,
            data: {
                name: packageName,
                repoUrl: depRow?.repoUrl ?? null,
                projects: scanRows,
                latestVersion: versionRow?.latestVersion ?? scanRows[0]?.latestVersion ?? null,
                lastPublishedAt: versionRow?.lastPublishedAt ?? null,
                registryResolved: true
            }
        });
    });

    const registryCacheService = container.resolve(RegistryCacheService);

    registerRoute(
        app,
        rescanPackageRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { packageName } = request.params;

            const rows = await db
                .select()
                .from(scanResults)
                .where(eq(scanResults.name, packageName))
                .all();

            if (rows.length === 0) {
                sendOne({ reply: reply, data: { updated: 0 } });
                return;
            }

            const packageManager =
                (
                    await db.all<{ package_manager: string }>(
                        sql`SELECT p.package_manager FROM projects p
                            JOIN scan_results sr ON sr.project_id = p.id
                            WHERE sr.name = ${packageName} LIMIT 1`
                    )
                )[0]?.package_manager ?? "npm";

            const info = await registryCacheService.getPackageInfo(
                packageName,
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

                let upgradeType: string = "none";
                if (row.currentVersion !== resolvedLatest) {
                    const diff = semver.diff(row.currentVersion, resolvedLatest);
                    if (diff && semver.gt(resolvedLatest, row.currentVersion)) {
                        if (diff === "major" || diff === "premajor") {
                            upgradeType = "major";
                        } else if (diff === "minor" || diff === "preminor") {
                            upgradeType = "minor";
                        } else {
                            upgradeType = "patch";
                        }
                    }
                }

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

            sendOne({ reply: reply, data: { updated } });
        }
    );
}
