import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { LicenseQueryService as Abstraction } from "./abstractions/LicenseQueryService.js";
import type { LicenseSource } from "./abstractions/LicenseQueryService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licenses, licenseViolations, projects, teamProjects } from "#api/db/schema.js";
import { teamProjectIds } from "#api/utils/teamFilter.js";
import type { LicenseRiskTier } from "#shared/licenses/types.js";

const DEFAULT_PAGE_SIZE = 50;

type SortDirection = typeof asc | typeof desc;

class LicenseQueryServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async listLicenses(filters: Abstraction.ListFilters): Promise<Abstraction.ListResult> {
        const { db } = this.databaseClient;

        const conditions = this.buildLicenseConditions(filters);
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const page = filters.page ?? 1;
        const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
        const sortBy = filters.sortBy ?? "packageName";
        const direction: SortDirection = filters.sortOrder === "desc" ? desc : asc;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(licenses)
            .where(where)
            .get();
        const total = countResult?.count ?? 0;

        const rows = await db
            .select()
            .from(licenses)
            .where(where)
            .orderBy(this.resolveLicenseOrderBy(sortBy, direction))
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .all();

        return { items: rows.map(row => this.toLicenseRow(row)), total };
    }

    public async listProjectLicenses(
        filters: Abstraction.ProjectListFilters
    ): Promise<Abstraction.ProjectListResult> {
        const { db } = this.databaseClient;
        const { projectId, ...rest } = filters;

        const conditions = [
            eq(licenses.projectId, projectId),
            ...this.buildLicenseConditions(rest)
        ];
        const rows = await db
            .select()
            .from(licenses)
            .where(and(...conditions))
            .all();

        return { items: rows.map(row => this.toLicenseRow(row)), total: rows.length };
    }

    public async getLicenseSummary(
        filters: Abstraction.SummaryFilters
    ): Promise<Abstraction.Summary> {
        const { db } = this.databaseClient;
        const { teamId, projectId } = filters;
        const teamScopedProjectIds = teamId ? await this.resolveTeamProjectIds(teamId) : undefined;

        const licenseConditions: SQL[] = [];
        if (teamScopedProjectIds) {
            licenseConditions.push(inArray(licenses.projectId, teamScopedProjectIds));
        }
        if (projectId) {
            licenseConditions.push(eq(licenses.projectId, projectId));
        }
        const licenseFilter = licenseConditions.length > 0 ? and(...licenseConditions) : undefined;

        const violationConditions: SQL[] = [];
        if (teamScopedProjectIds) {
            violationConditions.push(inArray(licenseViolations.projectId, teamScopedProjectIds));
        }
        if (projectId) {
            violationConditions.push(eq(licenseViolations.projectId, projectId));
        }
        const violationFilter =
            violationConditions.length > 0 ? and(...violationConditions) : undefined;

        const allLicenseRows = await db.select().from(licenses).where(licenseFilter).all();
        const allLicenses = allLicenseRows.map(row => this.toLicenseRow(row));
        const allViolations = await db
            .select()
            .from(licenseViolations)
            .where(violationFilter)
            .all();
        const projectRows = await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .all();
        const projectNameById = new Map(projectRows.map(row => [row.id, row.name]));

        const uniquePackages = new Map<string, Abstraction.Row>();
        for (const license of allLicenses) {
            if (!uniquePackages.has(license.packageName)) {
                uniquePackages.set(license.packageName, license);
            }
        }

        const riskTierCounts: Abstraction.RiskTierCounts = {
            permissive: 0,
            "weak-copyleft": 0,
            copyleft: 0,
            proprietary: 0,
            unknown: 0
        };
        for (const license of uniquePackages.values()) {
            if (license.riskTier in riskTierCounts) {
                riskTierCounts[license.riskTier as keyof Abstraction.RiskTierCounts] += 1;
            }
        }

        const deniedPackageNames = new Set<string>();
        const violationCounts: Abstraction.ViolationActionCounts = { warn: 0, deny: 0 };
        const seenViolationPackages = new Map<string, string>();
        for (const violation of allViolations) {
            const existing = seenViolationPackages.get(violation.packageName);
            if (existing === violation.action) {
                continue;
            }
            seenViolationPackages.set(violation.packageName, violation.action);
            if (violation.action === "warn") {
                violationCounts.warn += 1;
            } else if (violation.action === "deny") {
                violationCounts.deny += 1;
                deniedPackageNames.add(violation.packageName);
            }
        }

        const totalPackages = uniquePackages.size;
        const compliantPercent =
            totalPackages > 0
                ? Math.round(((totalPackages - deniedPackageNames.size) / totalPackages) * 100)
                : 100;

        const summaryByProject = new Map<string, Abstraction.ProjectSummary>();
        const getOrCreateProjectSummary = (id: string): Abstraction.ProjectSummary => {
            let existing = summaryByProject.get(id);
            if (!existing) {
                existing = {
                    projectId: id,
                    projectName: projectNameById.get(id) ?? id,
                    total: 0,
                    denied: 0,
                    warned: 0
                };
                summaryByProject.set(id, existing);
            }
            return existing;
        };

        for (const license of allLicenses) {
            getOrCreateProjectSummary(license.projectId).total += 1;
        }
        for (const violation of allViolations) {
            const summary = getOrCreateProjectSummary(violation.projectId);
            if (violation.action === "deny") {
                summary.denied += 1;
            } else if (violation.action === "warn") {
                summary.warned += 1;
            }
        }

        return {
            totalPackages,
            compliantPercent,
            riskTierCounts,
            violationCounts,
            projectSummaries: Array.from(summaryByProject.values())
        };
    }

    public async listViolations(
        filters: Abstraction.ViolationListFilters
    ): Promise<Abstraction.ViolationListResult> {
        const { db } = this.databaseClient;
        const page = filters.page ?? 1;
        const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
        const offset = (page - 1) * pageSize;

        const conditions = this.buildViolationConditions(filters);
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(licenseViolations)
            .where(where)
            .get();
        const total = countResult?.count ?? 0;

        const items = await db
            .select()
            .from(licenseViolations)
            .where(where)
            .limit(pageSize)
            .offset(offset)
            .all();

        return { items, total };
    }

    public async getViolationsSummary(
        filters: Abstraction.ViolationsSummaryFilters
    ): Promise<Abstraction.ViolationsSummary> {
        const { db } = this.databaseClient;
        const teamScopedProjectIds = filters.teamId
            ? await this.resolveTeamProjectIds(filters.teamId)
            : undefined;
        const teamFilter = teamScopedProjectIds
            ? inArray(licenseViolations.projectId, teamScopedProjectIds)
            : undefined;

        const allViolations = await db.select().from(licenseViolations).where(teamFilter).all();
        const projectRows = await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .all();
        const projectNameById = new Map(projectRows.map(row => [row.id, row.name]));

        let warnCount = 0;
        let denyCount = 0;
        const byProjectMap = new Map<string, Abstraction.ViolationProjectSummary>();

        for (const violation of allViolations) {
            let projectSummary = byProjectMap.get(violation.projectId);
            if (!projectSummary) {
                projectSummary = {
                    projectId: violation.projectId,
                    projectName: projectNameById.get(violation.projectId) ?? violation.projectId,
                    warnCount: 0,
                    denyCount: 0
                };
                byProjectMap.set(violation.projectId, projectSummary);
            }

            if (violation.action === "warn") {
                warnCount += 1;
                projectSummary.warnCount += 1;
            } else if (violation.action === "deny") {
                denyCount += 1;
                projectSummary.denyCount += 1;
            }
        }

        return {
            total: allViolations.length,
            warnCount,
            denyCount,
            byProject: Array.from(byProjectMap.values())
        };
    }

    private toLicenseRow(row: typeof licenses.$inferSelect): Abstraction.Row {
        return {
            id: row.id,
            projectId: row.projectId,
            packageName: row.packageName,
            licenseName: row.licenseName,
            spdxId: row.spdxId,
            source: row.source as LicenseSource,
            riskTier: row.riskTier as LicenseRiskTier,
            licenseUrl: row.licenseUrl,
            scannedAt: row.scannedAt
        };
    }

    private buildLicenseConditions(filters: Abstraction.ListFilters): SQL[] {
        const conditions: SQL[] = [];
        if (filters.projectId) {
            conditions.push(eq(licenses.projectId, filters.projectId));
        }
        if (filters.riskTier) {
            conditions.push(eq(licenses.riskTier, filters.riskTier));
        }
        if (filters.spdxId) {
            conditions.push(eq(licenses.spdxId, filters.spdxId));
        }
        if (filters.packageName) {
            conditions.push(like(licenses.packageName, `%${filters.packageName}%`));
        }
        if (filters.teamId) {
            conditions.push(sql`${licenses.projectId} IN ${teamProjectIds(filters.teamId)}`);
        }
        if (filters.violationAction) {
            conditions.push(
                sql`${licenses.id} IN (
                    SELECT lv.license_id FROM license_violations lv
                    WHERE lv.license_id = ${licenses.id}
                    GROUP BY lv.license_id
                    HAVING MAX(CASE WHEN lv.action = 'deny' THEN 2 WHEN lv.action = 'warn' THEN 1 ELSE 0 END)
                        = ${filters.violationAction === "deny" ? 2 : 1}
                )`
            );
        }
        return conditions;
    }

    private buildViolationConditions(filters: Abstraction.ViolationListFilters): SQL[] {
        const conditions: SQL[] = [];
        if (filters.projectId) {
            conditions.push(eq(licenseViolations.projectId, filters.projectId));
        }
        if (filters.action) {
            conditions.push(eq(licenseViolations.action, filters.action));
        }
        if (filters.packageName) {
            conditions.push(like(licenseViolations.packageName, `%${filters.packageName}%`));
        }
        if (filters.teamId) {
            conditions.push(
                sql`${licenseViolations.projectId} IN ${teamProjectIds(filters.teamId)}`
            );
        }
        return conditions;
    }

    private resolveLicenseOrderBy(sortBy: string, direction: SortDirection): SQL {
        switch (sortBy) {
            case "licenseName":
                return direction(licenses.licenseName);
            case "riskTier":
                return direction(licenses.riskTier);
            case "projectName":
                return direction(
                    sql`(SELECT ${projects.name} FROM ${projects} WHERE ${projects.id} = ${licenses.projectId})`
                );
            default:
                return direction(licenses.packageName);
        }
    }

    private async resolveTeamProjectIds(teamId: string): Promise<string[]> {
        const { db } = this.databaseClient;
        const rows = await db
            .select({ projectId: teamProjects.projectId })
            .from(teamProjects)
            .where(eq(teamProjects.teamId, teamId))
            .all();
        return rows.map(row => row.projectId);
    }
}

export const LicenseQueryService = Abstraction.createImplementation({
    implementation: LicenseQueryServiceImpl,
    dependencies: [DatabaseClient]
});
