import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { zipSync, strToU8 } from "fflate";
import { sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { ExportBackupUseCase } from "../useCases/backup/index.js";

export function registerBackupExportRoutes(app: FastifyInstance, container: Container): void {
    app.get(
        "/api/projects/backup",
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const useCase = container.resolve(ExportBackupUseCase);
            const result = await useCase.execute();

            result.match({
                ok: payload => {
                    const jsonBytes = strToU8(JSON.stringify(payload));
                    const zipped = zipSync({ "backup.json": jsonBytes }, { level: 6 });
                    const buffer = Buffer.from(zipped.buffer, zipped.byteOffset, zipped.byteLength);

                    reply
                        .header("Content-Type", "application/zip")
                        .header("Content-Disposition", "attachment; filename=backup.zip")
                        .send(buffer);
                },
                fail: error =>
                    sendError({
                        reply,
                        request,
                        error: { ...error, code: "UNKNOWN" }
                    })
            });
        }
    );
}
