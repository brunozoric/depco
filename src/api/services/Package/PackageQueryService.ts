import { eq, sql, type SQL } from "drizzle-orm";
import { PackageQueryService as Abstraction } from "./abstractions/PackageQueryService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { dependencies } from "#api/db/schema.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import { DEFAULT_PAGE_SIZES } from "#shared/pagination.js";

const DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZES.large;

interface IRawPackageRow {
    name: string;
    projects: string;
    resolvedChangelogCount: number;
    totalChangelogCount: number;
    lastPublishedAt: number | null;
    dependencyKind: string;
    registryResolved: number;
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
    registryResolved: number;
}

interface IPackageDetailVersionRow {
    latestVersion: string;
    lastPublishedAt: number | null;
}

class PackageQueryServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async listPackages(filters: Abstraction.ListFilters): Promise<Abstraction.ListResult> {
        const { db } = this.databaseClient;
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
        } = filters;

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

        const items: Abstraction.ListItem[] = rawRows.map(row => ({
            name: row.name,
            projects: JSON.parse(row.projects) as Abstraction.ListProject[],
            resolvedChangelogCount: row.resolvedChangelogCount ?? 0,
            totalChangelogCount: row.totalChangelogCount ?? 0,
            lastPublishedAt: row.lastPublishedAt ?? null,
            dependencyKind: row.dependencyKind,
            registryResolved: row.registryResolved === 1
        }));

        return { items, total };
    }

    public async getPackageDetail(packageName: string): Promise<Abstraction.Detail | null> {
        const { db } = this.databaseClient;

        const scanRows = await db.all<IPackageDetailScanRow>(sql`
            SELECT sr.project_id AS projectId, p.name AS projectName,
                   sr.current_version AS currentVersion, sr.latest_version AS latestVersion,
                   sr.upgrade_type AS upgradeType, sr.dependency_kind AS dependencyKind,
                   sr.registry_resolved AS registryResolved
            FROM scan_results sr
            JOIN projects p ON sr.project_id = p.id
            WHERE sr.name = ${packageName}
        `);

        if (scanRows.length === 0) {
            return null;
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

        const projects: Abstraction.DetailProject[] = scanRows.map(row => ({
            projectId: row.projectId,
            projectName: row.projectName,
            currentVersion: row.currentVersion,
            latestVersion: row.latestVersion,
            upgradeType: row.upgradeType,
            dependencyKind: row.dependencyKind
        }));

        return {
            name: packageName,
            repoUrl: depRow?.repoUrl ?? null,
            projects,
            latestVersion: versionRow?.latestVersion ?? scanRows[0]?.latestVersion ?? null,
            lastPublishedAt: versionRow?.lastPublishedAt ?? null,
            registryResolved: scanRows.every(row => row.registryResolved === 1)
        };
    }
}

export const PackageQueryService = Abstraction.createImplementation({
    implementation: PackageQueryServiceImpl,
    dependencies: [DatabaseClient]
});
