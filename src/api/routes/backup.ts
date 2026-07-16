import { existsSync } from "fs";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerService } from "../services/abstractions/PackageManagerService.js";
import { registerProject } from "../services/registerProject.js";
import {
    appSettings,
    pmSecuritySettings,
    projects,
    dependencies,
    dependencyVersions,
    changelogs,
    registryCache
} from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface BackupChangelogEntry {
    content: string | null;
    source: string | null;
}

interface BackupVersionEntry {
    version: string;
    publishedAt: number | null;
    changelog?: BackupChangelogEntry;
}

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

interface BackupPayload {
    version: number;
    exportedAt: number;
    appSettings: Array<{ key: string; value: string }>;
    securitySettings: Array<{
        packageManager: string;
        configFile: string;
        fieldName: string;
        expectedValue: string;
    }>;
    projects: Array<{
        name: string;
        path: string;
        packageManager: string | null;
        pmVersion: string | null;
    }>;
    dependencies: Array<{
        name: string;
        repoUrl: string | null;
        versions: BackupVersionEntry[];
    }>;
    registryCache: Array<{
        packageName: string;
        data: string;
        cachedAt: number;
    }>;
}

export async function backupRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const packageManagerService = container.resolve(PackageManagerService);
    const { db } = databaseClient;

    app.addContentTypeParser(
        "application/octet-stream",
        { parseAs: "buffer" },
        (_request, body, done) => {
            done(null, body);
        }
    );

    app.get("/api/projects/backup", async (_request, reply) => {
        const allSettings = await db.select().from(appSettings).all();

        const allSecuritySettings = await db
            .select({
                packageManager: pmSecuritySettings.packageManager,
                configFile: pmSecuritySettings.configFile,
                fieldName: pmSecuritySettings.fieldName,
                expectedValue: pmSecuritySettings.expectedValue
            })
            .from(pmSecuritySettings)
            .all();

        const allProjects = await db
            .select({
                name: projects.name,
                path: projects.path,
                packageManager: projects.packageManager,
                pmVersion: projects.pmVersion
            })
            .from(projects)
            .all();

        const allDeps = await db.select().from(dependencies).all();
        const allVersions = await db.select().from(dependencyVersions).all();
        const allChangelogs = await db.select().from(changelogs).all();

        const exportDeps = allDeps.map(dep => {
            const versions: BackupVersionEntry[] = allVersions
                .filter(v => v.dependencyId === dep.id)
                .map(v => {
                    const cl = allChangelogs.find(c => c.dependencyVersionId === v.id);
                    const entry: BackupVersionEntry = {
                        version: v.version,
                        publishedAt: v.publishedAt
                    };
                    if (cl) {
                        entry.changelog = { content: cl.content, source: cl.source };
                    }
                    return entry;
                });
            return {
                name: dep.name,
                repoUrl: dep.repoUrl,
                versions
            };
        });

        const allCache = await db.select().from(registryCache).all();

        const payload: BackupPayload = {
            version: 1,
            exportedAt: Date.now(),
            appSettings: allSettings,
            securitySettings: allSecuritySettings,
            projects: allProjects,
            dependencies: exportDeps,
            registryCache: allCache
        };

        const jsonBytes = strToU8(JSON.stringify(payload));
        const zipped = zipSync({ "backup.json": jsonBytes }, { level: 6 });
        const buffer = Buffer.from(zipped.buffer, zipped.byteOffset, zipped.byteLength);

        reply
            .header("Content-Type", "application/zip")
            .header("Content-Disposition", "attachment; filename=backup.zip")
            .send(buffer);
    });

    app.post("/api/projects/backup", async (request, reply) => {
        const rawBody = request.body as Buffer;
        const unzipped = unzipSync(new Uint8Array(rawBody));
        const jsonFile = unzipped["backup.json"];

        if (!jsonFile) {
            reply.status(400).send({ error: "ZIP must contain backup.json" });
            return;
        }

        const content = strFromU8(jsonFile);
        const backup = JSON.parse(content) as BackupPayload;

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
            if (inserted.rowsAffected > 0) {
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
            if (inserted.rowsAffected > 0) {
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
            if (inserted.rowsAffected > 0) {
                result.registryCache.imported++;
            } else {
                result.registryCache.skipped++;
            }
        }

        for (const project of backup.projects) {
            if (!existsSync(project.path)) {
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
                    `${project.path}: ${err instanceof Error ? err.message : "Unknown error"}`
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

            if (depInserted.rowsAffected > 0) {
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

                if (vInserted.rowsAffected > 0) {
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

                        if (clInserted.rowsAffected > 0) {
                            result.dependencies.imported++;
                        } else {
                            result.dependencies.skipped++;
                        }
                    }
                }
            }
        }

        reply.send(result);
    });
}
