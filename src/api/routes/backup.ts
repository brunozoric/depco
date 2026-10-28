import type { FastifyInstance } from "fastify";
import { registerBackupExportRoutes } from "./backup/backupExportRoutes.js";
import { registerBackupImportRoutes } from "./backup/backupImportRoutes.js";

export async function backupRoutes(app: FastifyInstance): Promise<void> {
    app.addContentTypeParser(
        "application/octet-stream",
        { parseAs: "buffer" },
        (_request, body, done) => {
            done(null, body);
        }
    );

    registerBackupExportRoutes(app);
    registerBackupImportRoutes(app);
}
