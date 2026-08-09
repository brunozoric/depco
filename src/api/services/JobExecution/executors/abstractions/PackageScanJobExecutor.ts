import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IPackageScanJobExecutor extends JobExecutor.Interface {
    readonly type: "package-scan";
}

export const PackageScanJobExecutor = createAbstraction<IPackageScanJobExecutor>(
    "Api/PackageScanJobExecutor"
);

export namespace PackageScanJobExecutor {
    export type Interface = IPackageScanJobExecutor;
}
