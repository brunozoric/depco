import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IEngineScanJobExecutor extends JobExecutor.Interface {
    readonly type: "engine-scan";
}

export const EngineScanJobExecutor = createAbstraction<IEngineScanJobExecutor>(
    "Api/EngineScanJobExecutor"
);

export namespace EngineScanJobExecutor {
    export type Interface = IEngineScanJobExecutor;
}
