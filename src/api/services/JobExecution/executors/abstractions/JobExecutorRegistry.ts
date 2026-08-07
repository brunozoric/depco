import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IJobExecutorRegistry {
    getExecutor(type: string): JobExecutor.Interface;
}

export const JobExecutorRegistry =
    createAbstraction<IJobExecutorRegistry>("Api/JobExecutorRegistry");

export namespace JobExecutorRegistry {
    export type Interface = IJobExecutorRegistry;
}
