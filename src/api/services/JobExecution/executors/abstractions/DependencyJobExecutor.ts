import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IDependencyJobExecutor extends JobExecutor.Interface {}

export const DependencyJobExecutor = createAbstraction<IDependencyJobExecutor>(
    "Api/DependencyJobExecutor"
);

export namespace DependencyJobExecutor {
    export type Interface = IDependencyJobExecutor;
}
