import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import { ChangelogJobExecutor as Abstraction } from "./abstractions/ChangelogJobExecutor.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { changelogs, dependencies, dependencyVersions } from "#api/db/schema.js";
import { ChangelogResolver } from "../changelogResolvers/abstractions/ChangelogResolver.js";
import { compareVersions } from "../ChangelogService.js";

const changelogPackagesSchema = z.object({
    packageName: z.string(),
    from: z.string(),
    to: z.string()
});

class ChangelogJobExecutorImpl implements JobExecutor.Interface {
    public readonly type = "changelog";
    private readonly resolvers: ChangelogResolver.Interface[];

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        resolvers: ChangelogResolver.Interface[],
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {
        this.resolvers = resolvers;
    }

    public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
        const { packageName, from, to } = changelogPackagesSchema.parse(
            JSON.parse(context.packagesJson ?? "{}")
        );

        context.appendLog(`Resolving changelogs for ${packageName} (${from} → ${to})`);

        const depRow = await this.databaseClient.db
            .select()
            .from(dependencies)
            .where(eq(dependencies.name, packageName))
            .get();

        if (!depRow) {
            context.appendLog("Package not found in dependencies table");
            return;
        }

        const allUnfetched = await this.databaseClient.db
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

        const unfetched = allUnfetched.filter(
            row =>
                !row.version.includes("-") &&
                compareVersions(row.version, from) > 0 &&
                compareVersions(row.version, to) <= 0
        );

        if (unfetched.length === 0) {
            context.appendLog("All versions already resolved");
            return;
        }

        const versions = unfetched.map(row => row.version);
        context.appendLog(`${versions.length} versions to resolve: ${versions.join(", ")}`);

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
                context.appendLog(`Found ${found.size} entries via ${winnerName}`);
                break;
            }
        }

        const fetchedAt = Date.now();
        for (const row of unfetched) {
            const content = found.get(row.version);
            const source = content !== undefined ? winnerName : "none";

            await this.databaseClient.db
                .update(changelogs)
                .set({
                    content: content ?? "",
                    source,
                    fetchedAt
                })
                .where(and(eq(changelogs.id, row.id), isNull(changelogs.content)))
                .run();

            this.webSocketBroadcaster.broadcast("changelog:resolved", {
                packageName,
                version: row.version,
                content: content ?? "",
                source
            });

            context.appendLog(`${row.version}: ${source}`);
        }
    }
}

export const ChangelogJobExecutor = Abstraction.createImplementation({
    implementation: ChangelogJobExecutorImpl,
    dependencies: [DatabaseClient, [ChangelogResolver, { multiple: true }], WebSocketBroadcaster]
});
