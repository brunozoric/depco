import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { registerRoute, sendList } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appLogs } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface ILogFilters {
    level?: string | undefined;
    source?: string | undefined;
    projectId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}

interface ICountRow {
    count: number;
}

function buildConditions(filters: ILogFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.level) {
        conditions.push(eq(appLogs.level, filters.level));
    }
    if (filters.source) {
        conditions.push(eq(appLogs.source, filters.source));
    }
    if (filters.projectId) {
        conditions.push(eq(appLogs.projectId, filters.projectId));
    }
    if (filters.from) {
        conditions.push(gte(appLogs.createdAt, parseInt(filters.from, 10)));
    }
    if (filters.to) {
        conditions.push(lte(appLogs.createdAt, parseInt(filters.to, 10)));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function logsRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, listLogsRoute, {}, async (request, reply) => {
        const { level, source, projectId, from, to, limit, offset } = request.query;
        const where = buildConditions({ level, source, projectId, from, to });

        const parsedLimit = limit ? parseInt(limit, 10) : 100;
        const parsedOffset = offset ? parseInt(offset, 10) : 0;

        const [items, countResult] = await Promise.all([
            db
                .select()
                .from(appLogs)
                .where(where)
                .orderBy(sql`${appLogs.createdAt} DESC`)
                .limit(parsedLimit)
                .offset(parsedOffset)
                .all(),
            db
                .select({ count: sql<number>`COUNT(*)` })
                .from(appLogs)
                .where(where)
                .get() as ICountRow | undefined
        ]);

        sendList({ reply: reply, items: items, total: countResult?.count ?? 0 });
    });

    registerRoute(
        app,
        deleteLogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { level, source, projectId, from, to } = request.body;
            const where = buildConditions({ level, source, projectId, from, to });

            const countResult = (await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(appLogs)
                .where(where)
                .get()) as ICountRow | undefined;

            const deleted = countResult?.count ?? 0;

            if (where) {
                await db.delete(appLogs).where(where).run();
            } else {
                await db.delete(appLogs).run();
            }

            reply.send({ deleted });
        }
    );
}
