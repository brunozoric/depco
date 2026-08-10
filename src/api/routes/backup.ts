import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerBackupExportRoutes } from "./backup/backupExportRoutes.js";
import { registerBackupImportRoutes } from "./backup/backupImportRoutes.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function backupRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
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
