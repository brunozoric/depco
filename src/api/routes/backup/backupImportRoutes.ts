import { access } from "fs/promises";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { unzipSync, strFromU8 } from "fflate";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerService } from "../../services/PackageManager/index.js";
import { registerProject } from "../../utils/registerProject.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { getErrorMessage } from "#shared/errors.js";
import {
    appSettings,
    pmSecuritySettings,
    projects,
    dependencies,
    dependencyVersions,
    changelogs,
    registryCache
} from "#api/db/schema.js";

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

interface ImportSectionResult {
    imported: number;
    skipped: number;
}

interface ImportProjectsResult extends ImportSectionResult {
    failed: number;
    errors: string[];
}

interface ImportResult {
    appSettings: ImportSectionResult;
    securitySettings: ImportSectionResult;
    projects: ImportProjectsResult;
    dependencies: ImportSectionResult;
    registryCache: ImportSectionResult;
}

export function registerBackupImportRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const packageManagerService = container.resolve(PackageManagerService);
    const { db } = databaseClient;

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
                reply.status(400).send({ error: "ZIP must contain backup.json" });
                return;
            }

            const content = strFromU8(jsonFile);
            const parseResult = backupPayloadSchema.safeParse(JSON.parse(content));
            if (!parseResult.success) {
                reply.status(400).send({ error: "Invalid backup format" });
                return;
            }
            const backup = parseResult.data;

            const result: ImportResult = {
                appSettings: { imported: 0, skipped: 0 },
                securitySettings: { imported: 0, skipped: 0 },
                projects: { imported: 0, skipped: 0, failed: 0, errors: [] },
                dependencies: { imported: 0, skipped: 0 },
                registryCache: { imported: 0, skipped: 0 }
            };

            for (const setting of backup.appSettings) {
                const inserted = await db
                    .insert(appSettings)
                    .values(setting)
                    .onConflictDoNothing()
                    .run();
                if (inserted.changes > 0) {
                    result.appSettings.imported++;
                } else {
                    result.appSettings.skipped++;
                }
            }

            for (const setting of backup.securitySettings) {
                const inserted = await db
                    .insert(pmSecuritySettings)
                    .values({ id: generateId(), ...setting })
                    .onConflictDoNothing()
                    .run();
                if (inserted.changes > 0) {
                    result.securitySettings.imported++;
                } else {
                    result.securitySettings.skipped++;
                }
            }

            for (const entry of backup.registryCache) {
                const inserted = await db
                    .insert(registryCache)
                    .values(entry)
                    .onConflictDoNothing()
                    .run();
                if (inserted.changes > 0) {
                    result.registryCache.imported++;
                } else {
                    result.registryCache.skipped++;
                }
            }

            for (const project of backup.projects) {
                try {
                    await access(project.path);
                } catch {
                    result.projects.failed++;
                    result.projects.errors.push(`Path does not exist: ${project.path}`);
                    continue;
                }

                const existing = await db
                    .select()
                    .from(projects)
                    .where(eq(projects.path, project.path))
                    .get();

                if (existing) {
                    result.projects.skipped++;
                    continue;
                }

                try {
                    await registerProject({
                        projectPath: project.path,
                        databaseClient,
                        packageManagerService
                    });
                    result.projects.imported++;
                } catch (err) {
                    result.projects.failed++;
                    result.projects.errors.push(
                        `${project.path}: ${getErrorMessage(err, "Unknown error")}`
                    );
                }
            }

            for (const dep of backup.dependencies) {
                const depInserted = await db
                    .insert(dependencies)
                    .values({
                        id: generateId(),
                        name: dep.name,
                        repoUrl: dep.repoUrl,
                        createdAt: Date.now()
                    })
                    .onConflictDoNothing()
                    .run();

                const depRow = await db
                    .select()
                    .from(dependencies)
                    .where(eq(dependencies.name, dep.name))
                    .get();

                if (!depRow) {
                    continue;
                }

                if (depInserted.changes > 0) {
                    result.dependencies.imported++;
                } else {
                    result.dependencies.skipped++;
                }

                for (const version of dep.versions) {
                    const vInserted = await db
                        .insert(dependencyVersions)
                        .values({
                            id: generateId(),
                            dependencyId: depRow.id,
                            version: version.version,
                            publishedAt: version.publishedAt
                        })
                        .onConflictDoNothing()
                        .run();

                    if (vInserted.changes > 0) {
                        result.dependencies.imported++;
                    } else {
                        result.dependencies.skipped++;
                    }

                    if (version.changelog) {
                        const versionRow = (
                            await db
                                .select()
                                .from(dependencyVersions)
                                .where(eq(dependencyVersions.dependencyId, depRow.id))
                                .all()
                        ).find(v => v.version === version.version);

                        if (versionRow) {
                            const clInserted = await db
                                .insert(changelogs)
                                .values({
                                    id: generateId(),
                                    dependencyId: depRow.id,
                                    dependencyVersionId: versionRow.id,
                                    content: version.changelog.content,
                                    source: version.changelog.source,
                                    fetchedAt: Date.now()
                                })
                                .onConflictDoNothing()
                                .run();

                            if (clInserted.changes > 0) {
                                result.dependencies.imported++;
                            } else {
                                result.dependencies.skipped++;
                            }
                        }
                    }
                }
            }

            reply.send(result);
        }
    );
}
