import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { unzipSync, strFromU8 } from "fflate";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { sendError, sendList } from "#shared/routing/index.js";
import type { ImportResult } from "#shared/responses/backup.js";
import { ImportBackupUseCase } from "../useCases/backup/index.js";

const backupChangelogEntrySchema = z.object({
    content: z.string().nullable(),
    source: z.string().nullable()
});

const backupVersionEntrySchema = z.object({
    version: z.string(),
    publishedAt: z.number().nullable(),
    changelog: backupChangelogEntrySchema.optional()
});

const backupPayloadSchema = z.object({
    version: z.number(),
    exportedAt: z.number(),
    appSettings: z.array(z.object({ key: z.string(), value: z.string() })),
    securitySettings: z.array(
        z.object({
            packageManager: z.string(),
            configFile: z.string(),
            fieldName: z.string(),
            expectedValue: z.string()
        })
    ),
    projects: z.array(
        z.object({
            name: z.string(),
            path: z.string(),
            packageManager: z.string().nullable(),
            pmVersion: z.string().nullable()
        })
    ),
    dependencies: z.array(
        z.object({
            name: z.string(),
            repoUrl: z.string().nullable(),
            versions: z.array(backupVersionEntrySchema)
        })
    ),
    registryCache: z.array(
        z.object({
            packageName: z.string(),
            data: z.string(),
            cachedAt: z.number()
        })
    )
});

export function registerBackupImportRoutes(app: FastifyInstance, container: Container): void {
    app.post(
        "/api/projects/backup",
        {
            preHandler: [requirePermission("full")],
            config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
        },
        async (request, reply) => {
            const rawBody = request.body as Buffer;
            const unzipped = unzipSync(new Uint8Array(rawBody));
            const jsonFile = unzipped["backup.json"];

            if (!jsonFile) {
                return sendError({
                    reply,
                    request,
                    error: {
                        code: "MISSING_BACKUP_JSON",
                        statusCode: 400,
                        message: "ZIP must contain backup.json"
                    }
                });
            }

            const content = strFromU8(jsonFile);
            const parseResult = backupPayloadSchema.safeParse(JSON.parse(content));
            if (!parseResult.success) {
                return sendError({
                    reply,
                    request,
                    error: {
                        code: "INVALID_BACKUP_FORMAT",
                        statusCode: 400,
                        message: "Invalid backup format"
                    }
                });
            }

            const useCase = container.resolve(ImportBackupUseCase);
            const result = await useCase.execute({ payload: parseResult.data });

            return sendList<ImportResult>({
                reply,
                request,
                result
            });
        }
    );
}
