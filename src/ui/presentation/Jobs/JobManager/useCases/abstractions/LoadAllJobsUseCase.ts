import { createAbstraction } from "#shared/index.js";
import type { IJobFilters } from "../../../../../features/Jobs/abstractions/JobsGateway.js";

export interface ILoadAllJobsUseCase {
    execute(filters: IJobFilters, limit?: number, offset?: number): Promise<void>;
}

export const LoadAllJobsUseCase = createAbstraction<ILoadAllJobsUseCase>("Ui/LoadAllJobsUseCase");

export namespace LoadAllJobsUseCase {
    export type Interface = ILoadAllJobsUseCase;
}
