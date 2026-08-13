import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import { backupPayloadSchema, importResultSchema } from "../responses/backup.js";

export const exportBackupRoute = defineRoute({
    method: "GET",
    path: "/api/projects/backup",
    description: "Export full application backup as JSON",
    params: z.object({}),
    response: backupPayloadSchema
});

export const importBackupRoute = defineRoute({
    method: "POST",
    path: "/api/projects/backup",
    description: "Import application backup from JSON",
    params: z.object({}),
    body: backupPayloadSchema,
    response: importResultSchema
});
