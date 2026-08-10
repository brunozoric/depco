import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq, and, asc } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listStepHooksRoute,
    createStepHookRoute,
    updateStepHookRoute,
    deleteStepHookRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { PackageJsonService } from "#api/services/PackageJson/index.js";
import { projects, projectStepHooks } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface StepHookResponse {
    id: string;
    projectId: string;
    position: string;
    name: string;
    command: string;
    type: "command" | "script" | "package-script";
    required: boolean;
    enabled: boolean;
    sortOrder: number;
    source: "db" | "file" | "package-json";
    createdAt: number;
    updatedAt: number;
}

function toResponse(row: typeof projectStepHooks.$inferSelect): StepHookResponse {
    return {
        id: row.id,
        projectId: row.projectId,
        position: row.position,
        name: row.name,
        command: row.command,
        type: row.type as StepHookResponse["type"],
        required: row.required === 1,
        enabled: row.enabled === 1,
        sortOrder: row.sortOrder,
        source: row.source as StepHookResponse["source"],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

export async function stepHooksRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    registerRoute(app, listStepHooksRoute, {}, async (request, reply) => {
        const { id } = request.params;

        const project = await db
            .select({ path: projects.path })
            .from(projects)
            .where(eq(projects.id, id))
            .get();

        if (!project) {
            sendError({ reply: reply, statusCode: 404, message: "Project not found" });
            return;
        }

        const fileConfigService = container.resolve(FileConfigService);
        const fileConfig = await fileConfigService.readConfig(project.path);

        const packageJsonService = container.resolve(PackageJsonService);
        const allScripts = await packageJsonService.getScripts(project.path);

        if (fileConfig?.stepHooks) {
            const stepHooks = fileConfig.stepHooks;
            const now = Date.now();
            const fileItems: StepHookResponse[] = stepHooks.map((hook, index) => ({
                id: `file-${index}`,
                projectId: id,
                position: hook.position,
                name: hook.name,
                command: hook.command,
                type: hook.executionType,
                required: hook.required,
                enabled: true,
                sortOrder: index,
                source: "file",
                createdAt: now,
                updatedAt: now
            }));

            const configuredNames = new Set(stepHooks.map(hook => hook.name));
            const discoveredScripts = allScripts.filter(
                script => !configuredNames.has(script.name)
            );

            reply.send({
                items: fileItems,
                configSource: "file" as const,
                discoveredScripts
            });
            return;
        }

        const rows = await db
            .select()
            .from(projectStepHooks)
            .where(eq(projectStepHooks.projectId, id))
            .orderBy(asc(projectStepHooks.position), asc(projectStepHooks.sortOrder))
            .all();

        const configuredNames = new Set(rows.map(row => row.name));
        const discoveredScripts = allScripts.filter(script => !configuredNames.has(script.name));

        reply.send({
            items: rows.map(toResponse),
            configSource: "db" as const,
            discoveredScripts
        });
    });

    registerRoute(
        app,
        createStepHookRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const { position, name, command, type, required } = request.body;
            const now = Date.now();

            const row = {
                id: generateId(),
                projectId: id,
                position,
                name,
                command,
                type,
                required: required ? 1 : 0,
                enabled: 1,
                sortOrder: 0,
                source: "db" as const,
                createdAt: now,
                updatedAt: now
            };

            await db.insert(projectStepHooks).values(row).run();
            sendOne({ reply: reply, data: toResponse(row) });
        }
    );

    registerRoute(
        app,
        updateStepHookRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id, hookId } = request.params;

            const existing = await db
                .select()
                .from(projectStepHooks)
                .where(and(eq(projectStepHooks.id, hookId), eq(projectStepHooks.projectId, id)))
                .get();

            if (!existing) {
                sendError({ reply: reply, statusCode: 404, message: "Step hook not found" });
                return;
            }

            const { name, command, type, required, enabled, sortOrder } = request.body;

            const merged: typeof projectStepHooks.$inferSelect = {
                ...existing,
                name: name ?? existing.name,
                command: command ?? existing.command,
                type: type ?? existing.type,
                required: required !== undefined ? (required ? 1 : 0) : existing.required,
                enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
                sortOrder: sortOrder ?? existing.sortOrder,
                updatedAt: Date.now()
            };

            await db
                .update(projectStepHooks)
                .set(merged)
                .where(eq(projectStepHooks.id, hookId))
                .run();

            sendOne({ reply: reply, data: toResponse(merged) });
        }
    );

    registerRoute(
        app,
        deleteStepHookRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id, hookId } = request.params;

            const existing = await db
                .select()
                .from(projectStepHooks)
                .where(and(eq(projectStepHooks.id, hookId), eq(projectStepHooks.projectId, id)))
                .get();

            if (!existing) {
                sendError({ reply: reply, statusCode: 404, message: "Step hook not found" });
                return;
            }

            await db.delete(projectStepHooks).where(eq(projectStepHooks.id, hookId)).run();
            reply.status(200).send({ deleted: true });
        }
    );
}
