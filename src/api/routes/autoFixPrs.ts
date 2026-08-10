import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listAutoFixPullRequestsRoute,
    getProjectAutoFixPullRequestsRoute,
    generateAutoFixPrRoute,
    deleteAutoFixPullRequestRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { autoFixPullRequests, projects } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IAutoFixPullRequestListQuerystring {
    projectId?: string | undefined;
    status?: string | undefined;
    teamId?: string | undefined;
}

function buildAutoFixPullRequestConditions(query: IAutoFixPullRequestListQuerystring): SQL[] {
    const conditions: SQL[] = [];
    if (query.projectId) {
        conditions.push(eq(autoFixPullRequests.projectId, query.projectId));
    }
    if (query.status) {
        conditions.push(eq(autoFixPullRequests.status, query.status));
    }
    if (query.teamId) {
        conditions.push(
            sql`${autoFixPullRequests.projectId} IN (SELECT project_id FROM team_projects WHERE team_id = ${query.teamId})`
        );
    }
    return conditions;
}

interface IAutoFixPullRequestListItem {
    id: string;
    projectId: string;
    packageNames: string[];
    fromVersions: Record<string, string>;
    toVersions: Record<string, string>;
    upgradeType: string;
    branchName: string;
    prUrl: string | null;
    prNumber: number | null;
    status: string;
    licenseWarnings: string[];
    createdAt: number;
    updatedAt: number;
}

function rowToPullRequestListItem(
    row: typeof autoFixPullRequests.$inferSelect
): IAutoFixPullRequestListItem {
    return {
        id: row.id,
        projectId: row.projectId,
        packageNames: JSON.parse(row.packageNames) as string[],
        fromVersions: JSON.parse(row.fromVersions) as Record<string, string>,
        toVersions: JSON.parse(row.toVersions) as Record<string, string>,
        upgradeType: row.upgradeType,
        branchName: row.branchName,
        prUrl: row.prUrl,
        prNumber: row.prNumber,
        status: row.status,
        licenseWarnings: row.licenseWarnings ? (JSON.parse(row.licenseWarnings) as string[]) : [],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

export async function autoFixPrRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const jobWorker = container.resolve(JobWorker);
    const { db } = databaseClient;

    // Registered before the parametrized "/:projectId/..." routes below so it
    // isn't shadowed by them.
    registerRoute(app, listAutoFixPullRequestsRoute, {}, async (request, reply) => {
        const page = request.query.page ?? 1;
        const pageSize = request.query.pageSize ?? 50;
        const offset = (page - 1) * pageSize;

        const conditions = buildAutoFixPullRequestConditions(request.query);
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(autoFixPullRequests)
            .where(where)
            .get();
        const total = countResult?.count ?? 0;

        const rows = await db
            .select()
            .from(autoFixPullRequests)
            .where(where)
            .limit(pageSize)
            .offset(offset)
            .all();

        const items = rows.map(rowToPullRequestListItem);
        sendList({ reply, items, total });
    });

    // Also registered before "/:projectId/pull-requests" — the fixed
    // "pull-requests" segment here sits one level deeper than that route's
    // ":projectId" segment, but keeping fixed-prefix routes grouped together
    // up front avoids any ambiguity as routes are added.
    registerRoute(
        app,
        deleteAutoFixPullRequestRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            await db.delete(autoFixPullRequests).where(eq(autoFixPullRequests.id, id)).run();
            reply.send({ deleted: true });
        }
    );

    registerRoute(app, getProjectAutoFixPullRequestsRoute, {}, async (request, reply) => {
        const { projectId } = request.params;
        const conditions: SQL[] = [eq(autoFixPullRequests.projectId, projectId)];
        if (request.query.status) {
            conditions.push(eq(autoFixPullRequests.status, request.query.status));
        }
        const rows = await db
            .select()
            .from(autoFixPullRequests)
            .where(and(...conditions))
            .all();
        const items = rows.map(rowToPullRequestListItem);
        sendList({ reply: reply, items: items, total: items.length });
    });

    registerRoute(
        app,
        generateAutoFixPrRoute,
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

            const jobId = await jobWorker.enqueue({
                referenceId: projectId,
                referenceType: "project",
                type: "auto-fix-pr"
            });
            reply.send({ jobId });
        }
    );
}
