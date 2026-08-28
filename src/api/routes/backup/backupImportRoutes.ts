import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { unzipSync, strFromU8 } from "fflate";
import { Result } from "#shared/index.js";
import { defineRoute, registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { backupPayloadSchema, importResultSchema } from "#shared/responses/backup.js";
import { ImportBackupUseCase } from "../useCases/backup/index.js";

// Body is a raw ZIP buffer (parsed by the octet-stream content type parser
// in backup.ts), so no body schema — the handler validates manually after
// unzipping.
const importBackupZipRoute = defineRoute({
    method: "POST",
    path: "/api/projects/backup",
    description: "Import application backup from ZIP",
    params: z.object({}),
    response: importResultSchema
});

export function registerBackupImportRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(
        app,
        importBackupZipRoute,
        {
            preHandler: [requirePermission("full")],
            config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
        },
        async (request, _reply, send) => {
            const body = request.body as unknown as Buffer;
            let unzipped: ReturnType<typeof unzipSync>;

            try {
                unzipped = unzipSync(new Uint8Array(body));
            } catch {
                return send.list({
                    result: Result.fail({
                        code: "INVALID_ZIP",
                        statusCode: 400,
                        message: "Request body is not a valid ZIP file"
                    })
                });
            }

            const jsonFile = unzipped["backup.json"];
            if (!jsonFile) {
                return send.list({
                    result: Result.fail({
                        code: "MISSING_BACKUP_JSON",
                        statusCode: 400,
                        message: "ZIP must contain backup.json"
                    })
                });
            }

            const content = strFromU8(jsonFile);
            const parseResult = backupPayloadSchema.safeParse(JSON.parse(content));
            if (!parseResult.success) {
                return send.list({
                    result: Result.fail({
                        code: "INVALID_BACKUP_FORMAT",
                        statusCode: 400,
                        message: "Invalid backup format"
                    })
                });
            }

            const useCase = container.resolve(ImportBackupUseCase);
            const result = await useCase.execute({ payload: parseResult.data });

            return send.list({ result });
        }
    );
}
