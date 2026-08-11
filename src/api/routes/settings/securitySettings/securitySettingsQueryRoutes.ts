import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { generateId } from "@webiny/stdlib";
import { registerRoute } from "#shared/routing/index.js";
import { listSecuritySettingsRoute } from "#shared/routes/index.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import type { PackageManagerId } from "#shared/security/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { toSecuritySettingResponse } from "./securitySettingsShared.js";
import type { SecuritySettingResponse } from "./securitySettingsShared.js";

export function registerSecuritySettingsQueryRoutes(
    app: FastifyInstance,
    container: Container
): void {
    const databaseClient = container.resolve(DatabaseClient);

    registerRoute(app, listSecuritySettingsRoute, {}, async (_request, reply) => {
        const dbRows = await databaseClient.db.select().from(pmSecuritySettings).all();

        const fileConfigService = container.resolve(FileConfigService);
        const fileConfigResult = await fileConfigService.readGlobalConfig();

        if (fileConfigResult.error) {
            const items = dbRows.map(toSecuritySettingResponse);
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
            const items = dbRows.map(toSecuritySettingResponse);
            reply.send({
                items,
                total: items.length,
                configSource: "db" as const,
                fileManagedPms: []
            });
            return;
        }

        const fileManagedPms = Object.keys(fileSecuritySettings);

        const dbItems = dbRows
            .filter(row => !fileManagedPms.includes(row.packageManager))
            .map(toSecuritySettingResponse);

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
}
