import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendOne, sendNone } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listScanSchedulesRoute,
    upsertScanScheduleRoute,
    deleteScanScheduleRoute,
    getScanScheduleDefaultRoute,
    upsertScanScheduleDefaultRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/abstractions/ScanSchedulerService.js";
import { projects, scanSchedules, appSettings } from "#api/db/schema.js";

const SCAN_SCHEDULE_DEFAULT_KEY = "scan_schedule_default";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function scanScheduleRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const scheduler = container.resolve(ScanSchedulerService);
    const { db } = databaseClient;

    registerRoute(app, listScanSchedulesRoute, {}, async (_request, reply) => {
        const allProjects = await db.select().from(projects).all();
        const overrides = await db.select().from(scanSchedules).all();
        const overrideMap = new Map(overrides.map(override => [override.projectId, override]));

        const globalRow = await db
            .select()
            .from(appSettings)
            .where(eq(appSettings.key, SCAN_SCHEDULE_DEFAULT_KEY))
            .get();
        const globalDefault = globalRow?.value ?? "disabled";

        const items = allProjects.map(project => {
            const override = overrideMap.get(project.id);
            return {
                projectId: project.id,
                projectName: project.name,
                interval: override?.interval ?? globalDefault,
                source: override ? ("project" as const) : ("default" as const),
                lastRunAt: override?.lastRunAt ?? null,
                nextRunAt: override?.nextRunAt ?? null
            };
        });

        reply.send({ items, globalDefault });
    });

    registerRoute(
        app,
        upsertScanScheduleRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { projectId } = request.params;
            const { interval } = request.body;
            const now = Date.now();

            const existing = await db
                .select()
                .from(scanSchedules)
                .where(eq(scanSchedules.projectId, projectId))
                .get();

            if (existing) {
                await db
                    .update(scanSchedules)
                    .set({ interval, updatedAt: now })
                    .where(eq(scanSchedules.projectId, projectId))
                    .run();

                await scheduler.scheduleProject(projectId);

                sendOne(reply, {
                    ...existing,
                    interval,
                    updatedAt: now,
                    enabled: existing.enabled === 1
                });
            } else {
                const id = generateId();
                const row = {
                    id,
                    projectId,
                    interval,
                    lastRunAt: null,
                    nextRunAt: null,
                    enabled: 1,
                    createdAt: now,
                    updatedAt: now
                };

                await db.insert(scanSchedules).values(row).run();
                await scheduler.scheduleProject(projectId);

                sendOne(reply, { ...row, enabled: true });
            }
        }
    );

    registerRoute(
        app,
        deleteScanScheduleRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { projectId } = request.params;

            await db.delete(scanSchedules).where(eq(scanSchedules.projectId, projectId)).run();

            await scheduler.scheduleProject(projectId);
            sendNone(reply, 204);
        }
    );

    registerRoute(app, getScanScheduleDefaultRoute, {}, async (_request, reply) => {
        const row = await db
            .select()
            .from(appSettings)
            .where(eq(appSettings.key, SCAN_SCHEDULE_DEFAULT_KEY))
            .get();

        sendOne(reply, { interval: row?.value ?? "disabled" });
    });

    registerRoute(
        app,
        upsertScanScheduleDefaultRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { interval } = request.body;

            await db
                .insert(appSettings)
                .values({ key: SCAN_SCHEDULE_DEFAULT_KEY, value: interval })
                .onConflictDoUpdate({
                    target: appSettings.key,
                    set: { value: interval }
                })
                .run();

            await scheduler.onGlobalDefaultChanged();
            sendOne(reply, { interval });
        }
    );
}
