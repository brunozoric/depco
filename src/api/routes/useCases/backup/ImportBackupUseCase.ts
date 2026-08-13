import { access } from "fs/promises";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerService } from "#api/services/PackageManager/index.js";
import { registerProject } from "#api/utils/registerProject.js";
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
import { ImportBackupUseCase as Abstraction } from "./abstractions/ImportBackupUseCase.js";
import type { IImportBackupResult } from "./backupTypes.js";

class ImportBackupUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly packageManagerService: PackageManagerService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const { payload } = params;

            const result: IImportBackupResult = {
                appSettings: { imported: 0, skipped: 0 },
                securitySettings: { imported: 0, skipped: 0 },
                projects: { imported: 0, skipped: 0, failed: 0, errors: [] },
                dependencies: { imported: 0, skipped: 0 },
                registryCache: { imported: 0, skipped: 0 }
            };

            for (const setting of payload.appSettings) {
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

            for (const setting of payload.securitySettings) {
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

            for (const entry of payload.registryCache) {
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

            for (const project of payload.projects) {
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
                        databaseClient: this.databaseClient,
                        packageManagerService: this.packageManagerService
                    });
                    result.projects.imported++;
                } catch (err) {
                    result.projects.failed++;
                    result.projects.errors.push(
                        `${project.path}: ${getErrorMessage(err, "Unknown error")}`
                    );
                }
            }

            for (const dep of payload.dependencies) {
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

            return Result.ok(result);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ImportBackupUseCase = Abstraction.createImplementation({
    implementation: ImportBackupUseCaseImpl,
    dependencies: [DatabaseClient, PackageManagerService]
});
