import type { ICreateJobInput } from "./abstractions/JobWorker.js";

interface IJobChainingDependencies {
    enqueue: (input: ICreateJobInput) => Promise<string>;
    isRefreshTransientFlagged: (jobId: string) => boolean;
    clearRefreshTransientFlag: (jobId: string) => void;
}

interface IChainableJob {
    id: string;
    referenceId: string;
    type: string;
    packages: string | null;
}

export async function chainRefreshTransientIfNeeded(
    job: IChainableJob,
    appendLog: (line: string) => void,
    dependencies: IJobChainingDependencies
): Promise<void> {
    if (job.type !== "dependency" || !dependencies.isRefreshTransientFlagged(job.id)) {
        return;
    }

    dependencies.clearRefreshTransientFlag(job.id);

    let packageNames: string | undefined;
    if (job.packages) {
        try {
            const parsed = JSON.parse(job.packages) as Array<{ name: string }>;
            const names = parsed.map(p => p.name);
            if (names.length > 0) {
                packageNames = JSON.stringify(names);
            }
        } catch {
            // fall through — refresh all
        }
    }

    try {
        await dependencies.enqueue({
            referenceId: job.referenceId,
            referenceType: "project",
            type: "transient",
            packages: packageNames,
            parentJobId: job.id
        });
    } catch (error) {
        appendLog(`Failed to enqueue transient refresh: ${String(error)}`);
    }
}

export async function chainScanAfterJobIfNeeded(
    job: IChainableJob,
    appendLog: (line: string) => void,
    enqueue: (input: ICreateJobInput) => Promise<string>
): Promise<void> {
    if (job.type !== "install" && job.type !== "dependency" && job.type !== "transient") {
        return;
    }

    try {
        await enqueue({
            referenceId: job.referenceId,
            referenceType: "project",
            type: "scan",
            parentJobId: job.id
        });
        appendLog(`Auto-scan enqueued after ${job.type}`);
    } catch (error) {
        appendLog(`Failed to enqueue auto-scan: ${String(error)}`);
    }
}
