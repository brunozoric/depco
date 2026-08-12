import { and, eq, isNull } from "drizzle-orm";
import { ChangelogService as Abstraction } from "./abstractions/ChangelogService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { changelogs, dependencies, dependencyVersions } from "#api/db/schema.js";
import { ChangelogResolver } from "./abstractions/ChangelogResolver.js";

// Numeric (major.minor.patch[...]) comparison used to order/filter stored
// changelog rows by version range. Non-numeric trailing parts (prerelease
// tags, etc.) are ignored — sufficient for ordering the versions this
// service stores, which are always drawn from a package's registry
// `versions` list.
export function compareVersions(a: string, b: string): number {
    const toParts = (version: string): number[] =>
        version.split(".").map(part => parseInt(part, 10) || 0);

    const aParts = toParts(a);
    const bParts = toParts(b);
    const length = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < length; i++) {
        const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }

    return 0;
}

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
}

export const ChangelogService = Abstraction.createImplementation({
    implementation: ChangelogServiceImpl,
    dependencies: [DatabaseClient, [ChangelogResolver, { multiple: true }]]
});
