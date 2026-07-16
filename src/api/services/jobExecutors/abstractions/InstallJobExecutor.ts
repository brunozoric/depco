import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IInstallJobExecutor extends JobExecutor.Interface {}

export const InstallJobExecutor = createAbstraction<IInstallJobExecutor>("Api/InstallJobExecutor");

export namespace InstallJobExecutor {
    export type Interface = IInstallJobExecutor;
}
