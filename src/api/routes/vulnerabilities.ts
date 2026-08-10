import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq, inArray } from "drizzle-orm";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listVulnerabilitiesRoute,
    getVulnerabilitySummaryRoute,
    getProjectVulnerabilitiesRoute,
    scanVulnerabilitiesRoute,
    refreshOsvCacheRoute,
    bulkVulnerabilitiesRoute,
    bulkRescanVulnerabilitiesRoute,
    exportVulnerabilitiesRoute,
    getVulnerabilityDetailRoute,
    getExpiredSnoozesRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import type {
    IVulnerabilityFilters,
    IEnrichedVulnerability,
    IEnrichAndSortOptions,
    TVulnerabilitySource
} from "#api/services/Vulnerability/index.js";
import { OsvCacheService } from "#api/services/Vulnerability/index.js";
import type { IOsvInvalidateOptions } from "#api/services/Vulnerability/index.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import { projects, teamProjects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IVulnerabilityQuerystring {
    severity?: string | undefined;
    packageName?: string | undefined;
    source?: string | undefined;
    projectIds?: string | undefined;
    includeDismissed?: "true" | "false" | undefined;
    scannedDate?: string | undefined;
    dependencyType?: "all" | "direct" | "transitive" | undefined;
}

interface IRefreshOsvBody {
    packageName?: string | undefined;
    packageNames?: string[] | undefined;
    all?: boolean | undefined;
    olderThanMs?: number | undefined;
    newerThanMs?: number | undefined;
}

function buildFilters(query: IVulnerabilityQuerystring): IVulnerabilityFilters {
    const filters: IVulnerabilityFilters = {};
    if (query.severity) {
        filters.severity = query.severity as VulnerabilitySeverity;
    }
    if (query.packageName) {
        filters.packageName = query.packageName;
    }
    if (query.source) {
        filters.source = query.source as TVulnerabilitySource;
    }
    if (query.projectIds) {
        filters.projectIds = query.projectIds.split(",");
    }
    if (query.includeDismissed === "true") {
        filters.includeDismissed = true;
    }
    if (query.scannedDate) {
        filters.scannedDate = query.scannedDate;
    }
    return filters;
}

async function resolveTeamProjectIds(
    db: DatabaseClient.Interface["db"],
    teamId: string
): Promise<string[]> {
    const rows = await db
        .select({ projectId: teamProjects.projectId })
        .from(teamProjects)
        .where(eq(teamProjects.teamId, teamId))
        .all();
    return rows.map(row => row.projectId);
}

function mergeTeamProjectIds(filters: IVulnerabilityFilters, teamProjectIds: string[]): void {
    if (filters.projectIds) {
        const teamProjectIdSet = new Set(teamProjectIds);
        filters.projectIds = filters.projectIds.filter(projectId =>
            teamProjectIdSet.has(projectId)
        );
    } else {
        filters.projectIds = teamProjectIds;
    }
}

function buildEnrichAndSortOptions(input: {
    dependencyType?: string | undefined;
    sortBy?: string | undefined;
    sortOrder?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}): IEnrichAndSortOptions {
    const options: IEnrichAndSortOptions = {};
    if (input.dependencyType !== undefined) {
        options.dependencyType = input.dependencyType;
    }
    if (input.sortBy !== undefined) {
        options.sortBy = input.sortBy;
    }
    if (input.sortOrder !== undefined) {
        options.sortOrder = input.sortOrder;
    }
    if (input.page !== undefined) {
        options.page = input.page;
    }
    if (input.pageSize !== undefined) {
        options.pageSize = input.pageSize;
    }
    return options;
}

function buildRefreshOptions(body: IRefreshOsvBody): IOsvInvalidateOptions {
    const options: IOsvInvalidateOptions = {};
    if (body.packageName !== undefined) {
        options.packageName = body.packageName;
    }
    if (body.packageNames !== undefined) {
        options.packageNames = body.packageNames;
    }
    if (body.all !== undefined) {
        options.all = body.all;
    }
    if (body.olderThanMs !== undefined) {
        options.olderThanMs = body.olderThanMs;
    }
    if (body.newerThanMs !== undefined) {
        options.newerThanMs = body.newerThanMs;
    }
    return options;
}

const CSV_HEADERS: Array<keyof IEnrichedVulnerability> = [
    "packageName",
    "installedVersion",
    "severity",
    "title",
    "cveId",
    "advisoryUrl",
    "source",
    "dependencyKind",
    "projectName",
    "vulnerableRange",
    "fixVersion"
];

function quoteCsvValue(value: unknown): string {
    const str = value == null ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
}

function toCsv(items: IEnrichedVulnerability[]): string {
    const lines = [CSV_HEADERS.map(header => quoteCsvValue(header)).join(",")];
    for (const item of items) {
        lines.push(CSV_HEADERS.map(header => quoteCsvValue(item[header])).join(","));
    }
    return lines.join("\n");
}

export async function vulnerabilityRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const vulnerabilityService = container.resolve(VulnerabilityService);
    const osvCacheService = container.resolve(OsvCacheService);
    const { db } = databaseClient;

    registerRoute(app, listVulnerabilitiesRoute, {}, async (request, reply) => {
        const filters = buildFilters(request.query);
        if (request.query.teamId) {
            const teamProjectIds = await resolveTeamProjectIds(db, request.query.teamId);
            mergeTeamProjectIds(filters, teamProjectIds);
            if (filters.projectIds && filters.projectIds.length === 0) {
                // VulnerabilityService.getAll treats an empty projectIds array as
                // "no filter" (falls through to all vulnerabilities), so a
                // teamId that resolves to zero matching projects must
                // short-circuit here rather than call getAll.
                sendList({ reply: reply, items: [], total: 0 });
                return;
            }
        }
        const items = await vulnerabilityService.getAll(filters);
        const result = await vulnerabilityService.enrichAndSort({
            items,
            options: buildEnrichAndSortOptions({
                dependencyType: request.query.dependencyType,
                sortBy: request.query.sortBy,
                sortOrder: request.query.sortOrder,
                page: request.query.page ?? 1,
                pageSize: request.query.pageSize ?? 25
            })
        });
        sendList({ reply: reply, items: result.items, total: result.total });
    });

    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(app, getVulnerabilitySummaryRoute, {}, async (request, reply) => {
        const { teamId } = request.query;
        if (teamId) {
            const teamProjectIds = await resolveTeamProjectIds(db, teamId);
            const summary = await vulnerabilityService.getSummary({
                projectIds: teamProjectIds
            });
            reply.send(summary);
            return;
        }
        const summary = await vulnerabilityService.getSummary();
        reply.send(summary);
    });

    // Registered before "/:projectId/scan" so it isn't shadowed by that param route.
    registerRoute(
        app,
        refreshOsvCacheRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const invalidated = await vulnerabilityService.forceOsvRefresh(
                buildRefreshOptions(request.body)
            );
            reply.send({ invalidated });
        }
    );

    registerRoute(
        app,
        bulkVulnerabilitiesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { ids } = request.body;
            let updatedCount: number;

            switch (request.body.action) {
                case "dismiss":
                    updatedCount = await vulnerabilityService.bulkDismiss(ids);
                    break;
                case "snooze":
                    updatedCount = await vulnerabilityService.bulkSnooze(
                        ids,
                        request.body.snoozeDays
                    );
                    break;
                case "undismiss":
                    updatedCount = await vulnerabilityService.bulkUndismiss(ids);
                    break;
            }

            reply.send({ updatedCount });
        }
    );

    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(
        app,
        bulkRescanVulnerabilitiesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { ids } = request.body;
            const projectIds = await vulnerabilityService.getProjectIdsForVulnerabilityIds(ids);

            const projectRows = await db
                .select()
                .from(projects)
                .where(inArray(projects.id, projectIds))
                .all();
            const projectMap = new Map(projectRows.map(p => [p.id, p]));

            let projectsQueued = 0;
            for (const projectId of projectIds) {
                const project = projectMap.get(projectId);
                if (project?.packageManager) {
                    await vulnerabilityService.scan({
                        projectId,
                        projectPath: project.path,
                        packageManager: project.packageManager
                    });
                    projectsQueued++;
                }
            }

            reply.send({ projectsQueued });
        }
    );

    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(app, exportVulnerabilitiesRoute, {}, async (request, reply) => {
        const {
            format,
            ids: idsParam,
            teamId,
            dependencyType,
            sortBy: exportSortBy,
            sortOrder: exportSortOrder,
            ...filterParams
        } = request.query;
        const filters = buildFilters(filterParams);
        if (teamId) {
            const teamProjectIds = await resolveTeamProjectIds(db, teamId);
            mergeTeamProjectIds(filters, teamProjectIds);
            if (filters.projectIds && filters.projectIds.length === 0) {
                const timestamp = new Date().toISOString().slice(0, 10);
                if (format === "json") {
                    reply
                        .header("Content-Type", "application/json")
                        .header(
                            "Content-Disposition",
                            `attachment; filename="vulnerabilities-${timestamp}.json"`
                        )
                        .send("[]");
                } else {
                    reply
                        .header("Content-Type", "text/csv")
                        .header(
                            "Content-Disposition",
                            `attachment; filename="vulnerabilities-${timestamp}.csv"`
                        )
                        .send(CSV_HEADERS.map(header => quoteCsvValue(header)).join(","));
                }
                return;
            }
        }

        const items = idsParam
            ? await vulnerabilityService.getAll({
                  ...filters,
                  ids: idsParam.split(",")
              })
            : await vulnerabilityService.getAll(filters);

        const result = await vulnerabilityService.enrichAndSort({
            items,
            options: buildEnrichAndSortOptions({
                dependencyType,
                sortBy: exportSortBy,
                sortOrder: exportSortOrder
            })
        });
        const sorted = result.items;
        const timestamp = new Date().toISOString().slice(0, 10);

        if (format === "json") {
            reply
                .header("Content-Type", "application/json")
                .header(
                    "Content-Disposition",
                    `attachment; filename="vulnerabilities-${timestamp}.json"`
                )
                .send(JSON.stringify(sorted, null, 2));
        } else {
            reply
                .header("Content-Type", "text/csv")
                .header(
                    "Content-Disposition",
                    `attachment; filename="vulnerabilities-${timestamp}.csv"`
                )
                .send(toCsv(sorted));
        }
    });

    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(app, getVulnerabilityDetailRoute, {}, async (request, reply) => {
        const { vulnerabilityId } = request.params;
        const vulnerability = await vulnerabilityService.getById(vulnerabilityId);

        if (!vulnerability) {
            reply.code(404).send({ error: "Vulnerability not found" });
            return;
        }

        let osvDetail: OsvCacheService.EnrichedDetail | null = null;
        if (vulnerability.cveId) {
            osvDetail = await osvCacheService.getEnrichedDetail(vulnerability.cveId);
        }

        reply.send({
            vulnerability: {
                ...vulnerability,
                dependencyKind: vulnerability.dependencyKind
            },
            osvDetail
        });
    });

    // Registered before "/:projectId" so it isn't shadowed by that param route.
    registerRoute(app, getExpiredSnoozesRoute, {}, async (request, reply) => {
        const { since } = request.query;
        const expired = await vulnerabilityService.getRecentlyExpiredSnoozes(since);
        const packageNames = [...new Set(expired.map(v => v.packageName))];
        reply.send({ count: expired.length, packageNames });
    });

    registerRoute(app, getProjectVulnerabilitiesRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const items = await vulnerabilityService.getLatest(projectId, buildFilters(request.query));
        const result = await vulnerabilityService.enrichAndSort({
            items,
            options: buildEnrichAndSortOptions({
                dependencyType: request.query.dependencyType,
                sortBy: request.query.sortBy,
                sortOrder: request.query.sortOrder,
                page: request.query.page ?? 1,
                pageSize: request.query.pageSize ?? 25
            })
        });
        sendList({ reply: reply, items: result.items, total: result.total });
    });

    registerRoute(
        app,
        scanVulnerabilitiesRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { projectId } = request.params;

            const project = await db
                .select()
                .from(projects)
                .where(eq(projects.id, projectId))
                .get();
            if (!project) {
                sendError({ reply: reply, statusCode: 404, message: "Project not found" });
                return;
            }

            if (!project.packageManager) {
                reply.status(422).send({
                    error: "Project has no detected package manager. Run a dependency scan first."
                });
                return;
            }

            const result = await vulnerabilityService.scan({
                projectId,
                projectPath: project.path,
                packageManager: project.packageManager
            });
            reply.send({ total: result.total, counts: result.counts });
        }
    );
}
