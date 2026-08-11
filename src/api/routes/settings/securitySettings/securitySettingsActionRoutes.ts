import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq, and } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { registerRoute, sendList, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    createSecuritySettingRoute,
    updateSecuritySettingRoute,
    toggleSecuritySettingRoute,
    resetSecuritySettingsRoute
} from "#shared/routes/index.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { toSecuritySettingResponse } from "./securitySettingsShared.js";

export function registerSecuritySettingsActionRoutes(
    app: FastifyInstance,
    container: Container
): void {
    const databaseClient = container.resolve(DatabaseClient);

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
            sendOne({ reply: reply, data: toSecuritySettingResponse(row), status: 201 });
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

            sendOne({
                reply: reply,
                data: toSecuritySettingResponse({ ...existing, expectedValue })
            });
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

            sendOne({
                reply: reply,
                data: toSecuritySettingResponse({ ...existing, enabled: newEnabled })
            });
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

            sendList({
                reply: reply,
                items: rows.map(toSecuritySettingResponse),
                total: rows.length
            });
        }
    );
}
