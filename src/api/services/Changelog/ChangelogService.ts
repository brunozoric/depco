import { and, eq, isNull, sql } from "drizzle-orm";
import { ChangelogService as Abstraction } from "./abstractions/ChangelogService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { changelogs, dependencies, dependencyVersions } from "#api/db/schema.js";
import { ChangelogResolver } from "./abstractions/ChangelogResolver.js";
import { compareVersions } from "#shared/versions/compareVersions.js";

export { compareVersions };

class ChangelogServiceImpl implements Abstraction.Interface {
    private readonly resolvers: ChangelogResolver.Interface[];

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        resolvers: ChangelogResolver.Interface[]
    ) {
        this.resolvers = resolvers;
    }

    public async resolve(packageName: string): Promise<void> {
        const depRow = await this.databaseClient.db
            .select()
            .from(dependencies)
            .where(eq(dependencies.name, packageName))
            .get();

        if (!depRow) {
            return;
        }

        const unfetched = await this.databaseClient.db
            .select({
                id: changelogs.id,
                version: dependencyVersions.version
            })
            .from(changelogs)
            .innerJoin(
                dependencyVersions,
                eq(changelogs.dependencyVersionId, dependencyVersions.id)
            )
            .where(and(eq(changelogs.dependencyId, depRow.id), isNull(changelogs.content)))
            .all();

        if (unfetched.length === 0) {
            return;
        }

        const versions = unfetched.map(row => row.version);

        let found = new Map<string, string>();
        let winnerName: string | null = null;

        for (const resolver of this.resolvers) {
            found = await resolver.resolve(
                packageName,
                depRow.repoUrl,
                versions,
                depRow.repoDirectory
            );
            if (found.size > 0) {
                winnerName = resolver.name;
                break;
            }
        }

        const fetchedAt = Date.now();
        for (const row of unfetched) {
            const content = found.get(row.version);
            await this.databaseClient.db
                .update(changelogs)
                .set({
                    content: content ?? "",
                    source: content !== undefined ? winnerName : "none",
                    fetchedAt
                })
                .where(and(eq(changelogs.id, row.id), isNull(changelogs.content)))
                .run();
        }
    }

    public async resetFailed(packageName: string): Promise<void> {
        const depRow = await this.databaseClient.db
            .select()
            .from(dependencies)
            .where(eq(dependencies.name, packageName))
            .get();

        if (!depRow) {
            return;
        }

        await this.databaseClient.db
            .update(changelogs)
            .set({ content: null, source: null, fetchedAt: null })
            .where(and(eq(changelogs.dependencyId, depRow.id), eq(changelogs.source, "none")))
            .run();
    }

    public async resetAllFailed(): Promise<Abstraction.ResetAllFailedPackage[]> {
        const failedRows = await this.databaseClient.db
            .select({
                packageName: dependencies.name,
                version: dependencyVersions.version
            })
            .from(changelogs)
            .innerJoin(dependencies, eq(changelogs.dependencyId, dependencies.id))
            .innerJoin(
                dependencyVersions,
                eq(changelogs.dependencyVersionId, dependencyVersions.id)
            )
            .where(eq(changelogs.source, "none"))
            .all();

        if (failedRows.length === 0) {
            return [];
        }

        await this.databaseClient.db
            .update(changelogs)
            .set({ content: null, source: null, fetchedAt: null })
            .where(eq(changelogs.source, "none"))
            .run();

        const byPackage = new Map<string, string[]>();
        for (const row of failedRows) {
            const versions = byPackage.get(row.packageName) ?? [];
            versions.push(row.version);
            byPackage.set(row.packageName, versions);
        }

        return Array.from(byPackage.entries()).map(([packageName, versions]) => {
            versions.sort(compareVersions);
            return {
                packageName,
                minVersion: versions[0]!,
                maxVersion: versions[versions.length - 1]!
            };
        });
    }

    public async getChangelogs(
        packageName: string,
        from: string,
        to: string
    ): Promise<Abstraction.Entry[]> {
        const depRow = await this.databaseClient.db
            .select()
            .from(dependencies)
            .where(eq(dependencies.name, packageName))
            .get();

        if (!depRow) {
            return [];
        }

        const rows = await this.databaseClient.db
            .select({
                version: dependencyVersions.version,
                content: changelogs.content,
                source: changelogs.source
            })
            .from(changelogs)
            .innerJoin(
                dependencyVersions,
                eq(changelogs.dependencyVersionId, dependencyVersions.id)
            )
            .where(eq(changelogs.dependencyId, depRow.id))
            .all();

        return rows
            .filter(
                row =>
                    !row.version.includes("-") &&
                    compareVersions(row.version, from) > 0 &&
                    compareVersions(row.version, to) <= 0
            )
            .sort((a, b) => compareVersions(a.version, b.version))
            .map(row => ({
                version: row.version,
                content: row.content,
                source: row.source
            }));
    }

    public async getStats(): Promise<Abstraction.Stats> {
        interface IStatsRow {
            total: number;
            resolved: number;
            failed: number;
            pending: number;
        }

        const countsRow = await this.databaseClient.db.get<IStatsRow>(sql`
            SELECT
                COUNT(*) AS total,
                COUNT(CASE WHEN content IS NOT NULL AND content != '' AND source != 'none' THEN 1 END) AS resolved,
                COUNT(CASE WHEN source = 'none' THEN 1 END) AS failed,
                COUNT(CASE WHEN content IS NULL THEN 1 END) AS pending
            FROM changelogs
        `);

        interface IResolverRow {
            source: string;
            count: number;
        }

        const resolverRows = await this.databaseClient.db.all<IResolverRow>(sql`
            SELECT source, COUNT(*) AS count
            FROM changelogs
            WHERE content IS NOT NULL AND content != '' AND source != 'none' AND source IS NOT NULL
            GROUP BY source
        `);

        const byResolver: Record<string, number> = {};
        for (const row of resolverRows) {
            byResolver[row.source] = row.count;
        }

        return {
            total: countsRow?.total ?? 0,
            resolved: countsRow?.resolved ?? 0,
            failed: countsRow?.failed ?? 0,
            pending: countsRow?.pending ?? 0,
            byResolver
        };
    }
}

export const ChangelogService = Abstraction.createImplementation({
    implementation: ChangelogServiceImpl,
    dependencies: [DatabaseClient, [ChangelogResolver, { multiple: true }]]
});
