import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
    appSettings,
    pmSecuritySettings,
    projects,
    dependencies,
    dependencyVersions,
    changelogs,
    registryCache
} from "#api/db/schema.js";
import { ExportBackupUseCase as Abstraction } from "./abstractions/ExportBackupUseCase.js";
import type { IBackupVersionEntry } from "./backupTypes.js";

class ExportBackupUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

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
                const versions: IBackupVersionEntry[] = allVersions
                    .filter(v => v.dependencyId === dep.id)
                    .map(v => {
                        const cl = allChangelogs.find(c => c.dependencyVersionId === v.id);
                        const entry: IBackupVersionEntry = {
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

            return Result.ok({
                version: 1,
                exportedAt: Date.now(),
                appSettings: allSettings,
                securitySettings: allSecuritySettings,
                projects: allProjects,
                dependencies: exportDeps,
                registryCache: allCache
            });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ExportBackupUseCase = Abstraction.createImplementation({
    implementation: ExportBackupUseCaseImpl,
    dependencies: [DatabaseClient]
});
