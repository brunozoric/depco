import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IChangelogJobExecutor extends JobExecutor.Interface {}

export const ChangelogJobExecutor = createAbstraction<IChangelogJobExecutor>(
    "Api/ChangelogJobExecutor"
);

export namespace ChangelogJobExecutor {
    export type Interface = IChangelogJobExecutor;
}
