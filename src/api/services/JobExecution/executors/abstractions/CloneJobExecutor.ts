import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface ICloneJobExecutor extends JobExecutor.Interface {}

export const CloneJobExecutor = createAbstraction<ICloneJobExecutor>("Api/CloneJobExecutor");

export namespace CloneJobExecutor {
    export type Interface = ICloneJobExecutor;
}
