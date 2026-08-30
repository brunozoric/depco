import type { FastifyInstance } from "fastify";
import type { IPluginOptions } from "./types.js";
import { registerBackupExportRoutes } from "./backup/backupExportRoutes.js";
import { registerBackupImportRoutes } from "./backup/backupImportRoutes.js";

export async function backupRoutes(app: FastifyInstance, options: IPluginOptions): Promise<void> {
    const { container } = options;

    app.addContentTypeParser(
        "application/octet-stream",
        { parseAs: "buffer" },
        (_request, body, done) => {
            done(null, body);
        }
    );

    registerBackupExportRoutes(app, container);
    registerBackupImportRoutes(app, container);
}
