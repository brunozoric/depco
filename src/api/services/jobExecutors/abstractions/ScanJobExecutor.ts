import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IScanJobExecutor extends JobExecutor.Interface {}

export const ScanJobExecutor = createAbstraction<IScanJobExecutor>("Api/ScanJobExecutor");

export namespace ScanJobExecutor {
    export type Interface = IScanJobExecutor;
}
