import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { JobWorker } from "#api/services/JobExecution/index.js";
import { upgradeJobs } from "#api/db/schema.js";
import { compareVersions } from "#api/services/Changelog/ChangelogService.js";

export interface IEnqueueChangelogDeps {
    db: DatabaseClient.Interface["db"];
    jobWorker: JobWorker.Interface;
}

export interface IEnqueueChangelogIfNeededParams {
    deps: IEnqueueChangelogDeps;
    packageName: string;
    from: string;
    to: string;
}

interface IActiveJobPackages {
    to?: string;
}

export async function enqueueChangelogIfNeeded(
    params: IEnqueueChangelogIfNeededParams
): Promise<void> {
    const { deps, packageName, from, to } = params;

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
        const activePackages = JSON.parse(activeJob.packages) as IActiveJobPackages;
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
