import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IPackageManagerJobExecutor extends JobExecutor.Interface {}

export const PackageManagerJobExecutor = createAbstraction<IPackageManagerJobExecutor>(
    "Api/PackageManagerJobExecutor"
);

export namespace PackageManagerJobExecutor {
    export type Interface = IPackageManagerJobExecutor;
}
