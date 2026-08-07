import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IAutoFixPrJobExecutor extends JobExecutor.Interface {}

export const AutoFixPrJobExecutor = createAbstraction<IAutoFixPrJobExecutor>(
    "Api/AutoFixPrJobExecutor"
);

export namespace AutoFixPrJobExecutor {
    export type Interface = IAutoFixPrJobExecutor;
}
