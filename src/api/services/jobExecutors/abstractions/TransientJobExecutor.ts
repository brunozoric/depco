import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface ITransientJobExecutor extends JobExecutor.Interface {}

export const TransientJobExecutor = createAbstraction<ITransientJobExecutor>(
    "Api/TransientJobExecutor"
);

export namespace TransientJobExecutor {
    export type Interface = ITransientJobExecutor;
}
