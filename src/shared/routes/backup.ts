import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const backupAppSettingSchema = z.object({
    key: z.string(),
    value: z.string()
});

const backupSecuritySettingSchema = z.object({
    packageManager: z.string(),
    configFile: z.string(),
    fieldName: z.string(),
    expectedValue: z.string()
});

const backupProjectSchema = z.object({
    name: z.string(),
    path: z.string(),
    packageManager: z.string().nullable(),
    pmVersion: z.string().nullable()
});

const backupChangelogSchema = z.object({
    content: z.string().nullable(),
    source: z.string().nullable()
});

const backupVersionSchema = z.object({
    version: z.string(),
    publishedAt: z.number().nullable(),
    changelog: backupChangelogSchema.optional()
});

const backupDependencySchema = z.object({
    name: z.string(),
    repoUrl: z.string().nullable(),
    versions: z.array(backupVersionSchema)
});

const backupRegistryCacheSchema = z.object({
    packageName: z.string(),
    data: z.string(),
    cachedAt: z.number()
});

const backupPayloadSchema = z.object({
    version: z.literal(1),
    exportedAt: z.number(),
    appSettings: z.array(backupAppSettingSchema),
    securitySettings: z.array(backupSecuritySettingSchema),
    projects: z.array(backupProjectSchema),
    dependencies: z.array(backupDependencySchema),
    registryCache: z.array(backupRegistryCacheSchema)
});

const importSectionResultSchema = z.object({
    imported: z.number(),
    skipped: z.number()
});

const importProjectsResultSchema = importSectionResultSchema.extend({
    failed: z.number(),
    errors: z.array(z.string())
});

const importResultSchema = z.object({
    appSettings: importSectionResultSchema,
    securitySettings: importSectionResultSchema,
    projects: importProjectsResultSchema,
    dependencies: importSectionResultSchema,
    registryCache: importSectionResultSchema
});

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
