import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { and, eq, inArray } from "drizzle-orm";
import { registerRoute } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { getChangelogsRoute, reResolveChangelogsRoute } from "#shared/routes/index.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/abstractions/JobWorker.js";
import { upgradeJobs } from "#api/db/schema.js";
import { compareVersions } from "#api/services/ChangelogService.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface EnqueueChangelogDeps {
    db: DatabaseClient.Interface["db"];
    jobWorker: JobWorker.Interface;
}

interface ActiveJobPackages {
    to?: string;
}

async function enqueueChangelogIfNeeded(
    deps: EnqueueChangelogDeps,
    packageName: string,
    from: string,
    to: string
): Promise<void> {
    const activeJob = await deps.db
        .select()
        .from(upgradeJobs)
        .where(
            and(
                eq(upgradeJobs.type, "changelog"),
                eq(upgradeJobs.referenceId, packageName),
                inArray(upgradeJobs.status, ["pending", "running"])
            )
        )
        .get();

    if (!activeJob) {
        await deps.jobWorker.enqueue({
            referenceId: packageName,
            referenceType: "package",
            type: "changelog",
            packages: JSON.stringify({ packageName, from, to })
        });
        return;
    }

    if (!activeJob.packages) {
        return;
    }

    try {
        const activePackages = JSON.parse(activeJob.packages) as ActiveJobPackages;
        if (activePackages.to && compareVersions(to, activePackages.to) > 0) {
            await deps.jobWorker.enqueue({
                referenceId: packageName,
                referenceType: "package",
                type: "changelog",
                packages: JSON.stringify({
                    packageName,
                    from: activePackages.to,
                    to
                })
            });
        }
    } catch {
        await deps.jobWorker.enqueue({
            referenceId: packageName,
            referenceType: "package",
            type: "changelog",
            packages: JSON.stringify({ packageName, from, to })
        });
    }
}

export async function changelogRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const changelogService = container.resolve(ChangelogService);
    const databaseClient = container.resolve(DatabaseClient);
    const jobWorker = container.resolve(JobWorker);

    registerRoute(app, getChangelogsRoute, {}, async (request, reply) => {
        const { packageName } = request.params;
        const { from, to } = request.query;

        if (from === to) {
            reply.send({ items: [], total: 0, resolving: false });
            return;
        }

        const entries = await changelogService.getChangelogs(packageName, from, to);

        const hasUnfetched = entries.some(entry => entry.content === null);

        let resolving = false;
        if (hasUnfetched) {
            await enqueueChangelogIfNeeded(
                { db: databaseClient.db, jobWorker },
                packageName,
                from,
                to
            );
            resolving = true;
        }

        reply.send({ items: entries, total: entries.length, resolving });
    });

    registerRoute(
        app,
        reResolveChangelogsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { packageName } = request.params;
            const { from, to } = request.body;

            if (from === to) {
                reply.send({ items: [], total: 0, resolving: false });
                return;
            }

            await changelogService.resetFailed(packageName);

            await enqueueChangelogIfNeeded(
                { db: databaseClient.db, jobWorker },
                packageName,
                from,
                to
            );

            const entries = await changelogService.getChangelogs(packageName, from, to);
            reply.send({ items: entries, total: entries.length, resolving: true });
        }
    );
}
