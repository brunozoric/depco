import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { zipSync, strToU8 } from "fflate";
import { defineRoute, registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { ExportBackupUseCase } from "../useCases/backup/index.js";

// Response is a ZIP binary sent via reply headers — no response schema.
const exportBackupZipRoute = defineRoute({
    method: "GET",
    path: "/api/projects/backup",
    description: "Export application backup as ZIP",
    params: z.object({})
});

export function registerBackupExportRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(
        app,
        exportBackupZipRoute,
        { preHandler: [requirePermission("full")] },
        async (_request, reply, send) => {
            const useCase = container.resolve(ExportBackupUseCase);
            const result = await useCase.execute();

            if (result.isFail()) {
                return send.none({ result });
            }

            const jsonBytes = strToU8(JSON.stringify(result.value));
            const zipped = zipSync({ "backup.json": jsonBytes }, { level: 6 });
            const buffer = Buffer.from(zipped.buffer, zipped.byteOffset, zipped.byteLength);

            return reply
                .header("Content-Type", "application/zip")
                .header("Content-Disposition", "attachment; filename=backup.zip")
                .send(buffer);
        }
    );
}
