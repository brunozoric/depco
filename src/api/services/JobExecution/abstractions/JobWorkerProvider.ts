import { createAbstraction } from "#shared/index.js";
import type { JobWorker } from "./JobWorker.js";

/**
 * Breaks the JobWorker <-> JobExecutorRegistry <-> ScanJobExecutor circular
 * dependency: JobWorker's constructor depends on JobExecutorRegistry, which
 * depends on every executor including ScanJobExecutor. If ScanJobExecutor
 * depended on JobWorker directly, resolving JobWorker would recurse back
 * into itself before the DI container has a cached singleton to return,
 * and @webiny/di throws "Circular dependency detected".
 *
 * JobWorkerProvider is registered via `container.registerFactory()` instead
 * of `container.register()`, so resolving it never triggers a nested
 * resolution of JobWorker — it just hands back a `get()` closure. Callers
 * invoke `get()` at call time (inside `execute()`, long after the DI graph
 * has finished booting), at which point JobWorker is already a resolved,
 * cached singleton and the lookup is a simple cache hit.
 */
export interface IJobWorkerProvider {
    get(): JobWorker.Interface;
}

export const JobWorkerProvider = createAbstraction<IJobWorkerProvider>("Api/JobWorkerProvider");

export namespace JobWorkerProvider {
    export type Interface = IJobWorkerProvider;
}
