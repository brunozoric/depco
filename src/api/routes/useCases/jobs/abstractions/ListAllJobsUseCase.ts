import { createAbstraction, Result } from "#shared/index.js";
import type { JobWorker } from "#api/services/JobExecution/index.js";
import type { IJobFilters } from "../jobConditions.js";

export interface IListAllJobsUseCaseParams extends IJobFilters {
    limit?: string | undefined;
    offset?: string | undefined;
}

export interface IListAllJobsUseCaseData {
    items: JobWorker.Job[];
    total: number;
}

export interface IListAllJobsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IListAllJobsUseCase {
    execute(
        params: IListAllJobsUseCaseParams
    ): Promise<Result<IListAllJobsUseCaseData, IListAllJobsUseCaseError>>;
}

export const ListAllJobsUseCase = createAbstraction<IListAllJobsUseCase>("Api/ListAllJobsUseCase");

export namespace ListAllJobsUseCase {
    export type Interface = IListAllJobsUseCase;
    export type Params = IListAllJobsUseCaseParams;
    export type Data = IListAllJobsUseCaseData;
    export type Error = IListAllJobsUseCaseError;
}
