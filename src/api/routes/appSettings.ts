import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/abstractions/EncryptionService.js";
import { FileConfigService } from "#api/services/abstractions/FileConfigService.js";
import { appSettings } from "#api/db/schema.js";

const TOKEN_KEYS = new Set(["github_token", "gitlab_token"]);

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IFileKeyMapping {
    fileKey: keyof FileConfigService.Settings;
    dbKey: string;
}

const FILE_KEY_MAPPINGS: IFileKeyMapping[] = [
    { fileKey: "branchTemplate", dbKey: "branch_template" },
    { fileKey: "commitTemplate", dbKey: "commit_template" },
    { fileKey: "logLevel", dbKey: "log_level" }
];

export async function appSettingsRoutes(
    app: FastifyInstance,
    options: PluginOptions
): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const encryptionService = container.resolve(EncryptionService);
    const { db } = databaseClient;

    registerRoute(app, listAppSettingsRoute, {}, async (_request, reply) => {
        const rows = await db
            .select()
            .from(appSettings)
            .all()
            .then(items =>
                items.map(row =>
                    TOKEN_KEYS.has(row.key) && row.value ? { ...row, value: "••••••••" } : row
                )
            );

        const fileConfigService = container.resolve(FileConfigService);
        const fileSettingsResult = await fileConfigService.readGlobalSettings();

        if (fileSettingsResult.error) {
            reply.send({
                items: rows,
                total: rows.length,
                configSource: "error",
                fileManaged: [],
                configError: fileSettingsResult.error,
                encryptionAvailable: encryptionService.isAvailable()
            });
            return;
        }

        const fileSettings = fileSettingsResult.settings;

        if (!fileSettings) {
            reply.send({
                items: rows,
                total: rows.length,
                configSource: "db",
                fileManaged: [],
                encryptionAvailable: encryptionService.isAvailable()
            });
            return;
        }

        const fileManaged: string[] = [];
        const merged = rows.map(row => ({ ...row }));

        for (const mapping of FILE_KEY_MAPPINGS) {
            const fileValue = fileSettings[mapping.fileKey];
            if (fileValue !== undefined) {
                fileManaged.push(mapping.dbKey);
                const existing = merged.find(row => row.key === mapping.dbKey);
                if (existing) {
                    existing.value = String(fileValue);
                } else {
                    merged.push({ key: mapping.dbKey, value: String(fileValue) });
                }
            }
        }

        reply.send({
            items: merged,
            total: merged.length,
            configSource: "file",
            encryptionAvailable: encryptionService.isAvailable(),
            fileManaged
        });
    });

    registerRoute(app, upsertAppSettingRoute, {}, async (request, reply) => {
        const { key } = request.params;
        const { value } = request.body;

        let storedValue = value;
        if (TOKEN_KEYS.has(key)) {
            if (!encryptionService.isAvailable()) {
                sendError(reply, 400, "ENCRYPTION_KEY not configured — cannot store tokens");
                return;
            }
            storedValue = await encryptionService.encrypt(value);
        }

        await db
            .insert(appSettings)
            .values({ key, value: storedValue })
            .onConflictDoUpdate({
                target: appSettings.key,
                set: { value: storedValue }
            })
            .run();

        sendOne(reply, { key, value: TOKEN_KEYS.has(key) ? "••••••••" : value });
    });
}
