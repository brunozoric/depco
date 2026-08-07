import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface ILicenseScanJobExecutor extends JobExecutor.Interface {
    readonly type: "license-scan";
}

export const LicenseScanJobExecutor = createAbstraction<ILicenseScanJobExecutor>(
    "Api/LicenseScanJobExecutor"
);

export namespace LicenseScanJobExecutor {
    export type Interface = ILicenseScanJobExecutor;
}
