import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { zipSync, strToU8 } from "fflate";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    appSettings,
    pmSecuritySettings,
    projects,
    dependencies,
    dependencyVersions,
    changelogs,
    registryCache
} from "#api/db/schema.js";

interface BackupChangelogEntry {
    content: string | null;
    source: string | null;
}

interface BackupVersionEntry {
    version: string;
    publishedAt: number | null;
    changelog?: BackupChangelogEntry;
}

interface BackupPayload {
    version: number;
    exportedAt: number;
    appSettings: { key: string; value: string }[];
    securitySettings: {
        packageManager: string;
        configFile: string;
        fieldName: string;
        expectedValue: string;
    }[];
    projects: {
        name: string;
        path: string;
        packageManager: string | null;
        pmVersion: string | null;
    }[];
    dependencies: {
        name: string;
        repoUrl: string | null;
        versions: BackupVersionEntry[];
    }[];
    registryCache: {
        packageName: string;
        data: string;
        cachedAt: number;
    }[];
}

export function registerBackupExportRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const { db } = databaseClient;

    app.get(
        "/api/projects/backup",
        { preHandler: [requirePermission("full")] },
        async (_request, reply) => {
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
        }
    );
}
