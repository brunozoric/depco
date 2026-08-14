import { z } from "zod";

export const backupAppSettingSchema = z.object({
    key: z.string(),
    value: z.string()
});

export const backupSecuritySettingSchema = z.object({
    packageManager: z.string(),
    configFile: z.string(),
    fieldName: z.string(),
    expectedValue: z.string()
});

export const backupProjectSchema = z.object({
    name: z.string(),
    path: z.string(),
    packageManager: z.string().nullable(),
    pmVersion: z.string().nullable()
});

export const backupChangelogSchema = z.object({
    content: z.string().nullable(),
    source: z.string().nullable()
});

export const backupVersionSchema = z.object({
    version: z.string(),
    publishedAt: z.number().nullable(),
    changelog: backupChangelogSchema.optional()
});

export const backupDependencySchema = z.object({
    name: z.string(),
    repoUrl: z.string().nullable(),
    versions: z.array(backupVersionSchema)
});

export const backupRegistryCacheSchema = z.object({
    packageName: z.string(),
    data: z.string(),
    cachedAt: z.number()
});

export const backupPayloadSchema = z.object({
    version: z.literal(1),
    exportedAt: z.number(),
    appSettings: z.array(backupAppSettingSchema),
    securitySettings: z.array(backupSecuritySettingSchema),
    projects: z.array(backupProjectSchema),
    dependencies: z.array(backupDependencySchema),
    registryCache: z.array(backupRegistryCacheSchema)
});

export const importSectionResultSchema = z.object({
    imported: z.number(),
    skipped: z.number()
});

export const importProjectsResultSchema = importSectionResultSchema.extend({
    failed: z.number(),
    errors: z.array(z.string())
});

export const importResultSchema = z.object({
    appSettings: importSectionResultSchema,
    securitySettings: importSectionResultSchema,
    projects: importProjectsResultSchema,
    dependencies: importSectionResultSchema,
    registryCache: importSectionResultSchema
});

export type BackupPayload = z.infer<typeof backupPayloadSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
