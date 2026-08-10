import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq, and } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendList, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listSecuritySettingsRoute,
    createSecuritySettingRoute,
    updateSecuritySettingRoute,
    toggleSecuritySettingRoute,
    resetSecuritySettingsRoute
} from "#shared/routes/index.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import type { PackageManagerId } from "#shared/security/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { pmSecuritySettings } from "#api/db/schema.js";

interface SecuritySettingResponse {
    id: string;
    packageManager: string;
    configFile: string;
    fieldName: string;
    expectedValue: string;
    enabled: boolean;
}

function toResponse(row: typeof pmSecuritySettings.$inferSelect): SecuritySettingResponse {
    return {
        id: row.id,
        packageManager: row.packageManager,
        configFile: row.configFile,
        fieldName: row.fieldName,
        expectedValue: row.expectedValue,
        enabled: row.enabled === 1
    };
}

export function registerSecuritySettingsRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);

    registerRoute(app, listSecuritySettingsRoute, {}, async (_request, reply) => {
        const dbRows = await databaseClient.db.select().from(pmSecuritySettings).all();

        const fileConfigService = container.resolve(FileConfigService);
        const fileConfigResult = await fileConfigService.readGlobalConfig();

        if (fileConfigResult.error) {
            const items = dbRows.map(toResponse);
            reply.send({
                items,
                total: items.length,
                configSource: "error" as const,
                fileManagedPms: [],
                configError: fileConfigResult.error
            });
            return;
        }

        const allPmSettings = fileConfigResult.config?.pmSettings;

        const fileSecuritySettings: Record<string, Record<string, string>> = {};
        if (allPmSettings) {
            for (const [pm, pmConfig] of Object.entries(allPmSettings)) {
                if (pmConfig.security && Object.keys(pmConfig.security).length > 0) {
                    fileSecuritySettings[pm] = pmConfig.security;
                }
            }
        }

        if (Object.keys(fileSecuritySettings).length === 0) {
            const items = dbRows.map(toResponse);
            reply.send({
                items,
                total: items.length,
                configSource: "db" as const,
                fileManagedPms: []
            });
            return;
        }

        const fileManagedPms = Object.keys(fileSecuritySettings);

        // Keep DB rows for non-file-managed PMs
        const dbItems = dbRows
            .filter(row => !fileManagedPms.includes(row.packageManager))
            .map(toResponse);

        // Synthesize rows for file-managed PMs — full replace per PM
        const fileItems: SecuritySettingResponse[] = [];
        for (const [pm, fields] of Object.entries(fileSecuritySettings)) {
            const registry = SECURITY_FIELD_REGISTRY[pm as PackageManagerId];
            if (!registry) {
                continue;
            }
            for (const [fieldName, expectedValue] of Object.entries(fields)) {
                const fieldDef = registry.find(f => f.fieldName === fieldName);
                fileItems.push({
                    id: generateId(),
                    packageManager: pm,
                    configFile: fieldDef?.configFile ?? "",
                    fieldName,
                    expectedValue,
                    enabled: true
                });
            }
        }

        const items = [...dbItems, ...fileItems];
        reply.send({
            items,
            total: items.length,
            configSource: "file" as const,
            fileManagedPms
        });
    });

    registerRoute(
        app,
        createSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { packageManager, fieldName, expectedValue } = request.body;

            const fields =
                SECURITY_FIELD_REGISTRY[packageManager as keyof typeof SECURITY_FIELD_REGISTRY];
            if (!fields) {
                sendError({
                    reply: reply,
                    statusCode: 400,
                    message: `Unknown package manager: ${packageManager}`
                });
                return;
            }

            const fieldDef = fields.find(f => f.fieldName === fieldName);
            if (!fieldDef) {
                sendError({
                    reply: reply,
                    statusCode: 400,
                    message: `Unknown field "${fieldName}" for ${packageManager}`
                });
                return;
            }

            const validation = fieldDef.expectedValueSchema.safeParse(expectedValue);
            if (!validation.success) {
                sendError({
                    reply: reply,
                    statusCode: 400,
                    message: validation.error.issues[0]?.message ?? "Invalid expected value"
                });
                return;
            }

            const existing = await databaseClient.db
                .select()
                .from(pmSecuritySettings)
                .where(
                    and(
                        eq(pmSecuritySettings.packageManager, packageManager),
                        eq(pmSecuritySettings.fieldName, fieldName)
                    )
                )
                .get();

            if (existing) {
                sendError({
                    reply: reply,
                    statusCode: 409,
                    message: `Setting "${fieldName}" already exists for ${packageManager}`
                });
                return;
            }

            const row = {
                id: generateId(),
                packageManager,
                configFile: fieldDef.configFile,
                fieldName,
                expectedValue,
                enabled: 1 as const
            };

            await databaseClient.db.insert(pmSecuritySettings).values(row).run();
            sendOne({ reply: reply, data: toResponse(row), status: 201 });
        }
    );

    registerRoute(
        app,
        updateSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;
            const { expectedValue } = request.body;

            const existing = await databaseClient.db
                .select()
                .from(pmSecuritySettings)
                .where(eq(pmSecuritySettings.id, id))
                .get();

            if (!existing) {
                sendError({ reply: reply, statusCode: 404, message: "Setting not found" });
                return;
            }

            const fields =
                SECURITY_FIELD_REGISTRY[
                    existing.packageManager as keyof typeof SECURITY_FIELD_REGISTRY
                ];
            const fieldDef = fields?.find(f => f.fieldName === existing.fieldName);

            if (fieldDef) {
                const validation = fieldDef.expectedValueSchema.safeParse(expectedValue);
                if (!validation.success) {
                    sendError({
                        reply: reply,
                        statusCode: 400,
                        message: validation.error.issues[0]?.message ?? "Invalid expected value"
                    });
                    return;
                }
            }

            await databaseClient.db
                .update(pmSecuritySettings)
                .set({ expectedValue })
                .where(eq(pmSecuritySettings.id, id))
                .run();

            sendOne({ reply: reply, data: toResponse({ ...existing, expectedValue }) });
        }
    );

    registerRoute(
        app,
        toggleSecuritySettingRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { id } = request.params;

            const existing = await databaseClient.db
                .select()
                .from(pmSecuritySettings)
                .where(eq(pmSecuritySettings.id, id))
                .get();

            if (!existing) {
                sendError({ reply: reply, statusCode: 404, message: "Setting not found" });
                return;
            }

            const newEnabled = existing.enabled === 1 ? 0 : 1;
            await databaseClient.db
                .update(pmSecuritySettings)
                .set({ enabled: newEnabled })
                .where(eq(pmSecuritySettings.id, id))
                .run();

            sendOne({ reply: reply, data: toResponse({ ...existing, enabled: newEnabled }) });
        }
    );

    registerRoute(
        app,
        resetSecuritySettingsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { packageManager } = request.body;

            const fields =
                SECURITY_FIELD_REGISTRY[packageManager as keyof typeof SECURITY_FIELD_REGISTRY];
            if (!fields) {
                sendError({
                    reply: reply,
                    statusCode: 400,
                    message: `Unknown package manager: ${packageManager}`
                });
                return;
            }

            await databaseClient.db
                .delete(pmSecuritySettings)
                .where(eq(pmSecuritySettings.packageManager, packageManager))
                .run();

            const rows = fields.map(field => ({
                id: generateId(),
                packageManager,
                configFile: field.configFile,
                fieldName: field.fieldName,
                expectedValue: field.defaultExpectedValue,
                enabled: 1 as const
            }));

            if (rows.length > 0) {
                await databaseClient.db.insert(pmSecuritySettings).values(rows).run();
            }

            sendList({ reply: reply, items: rows.map(toResponse), total: rows.length });
        }
    );
}
