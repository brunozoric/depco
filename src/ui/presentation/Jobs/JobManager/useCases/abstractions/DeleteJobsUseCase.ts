import { createAbstraction } from "#shared/index.js";
import type { IJobFilters } from "../../../../../features/Jobs/abstractions/JobsGateway.js";

export interface IDeleteJobsUseCase {
    execute(filters: IJobFilters): Promise<number>;
}

export const DeleteJobsUseCase = createAbstraction<IDeleteJobsUseCase>("Ui/DeleteJobsUseCase");

export namespace DeleteJobsUseCase {
    export type Interface = IDeleteJobsUseCase;
}
