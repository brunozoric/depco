import { createAbstraction, Result } from "#shared/index.js";
import type { JobWorker } from "#api/services/JobExecution/index.js";

export interface IListProjectJobsUseCaseParams {
    projectId: string;
}

export interface IListProjectJobsUseCaseData {
    items: JobWorker.Job[];
    total: number;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IListProjectJobsUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
}

type ListProjectJobsUseCaseError =
    IListProjectJobsUseCaseErrors[keyof IListProjectJobsUseCaseErrors];

export interface IListProjectJobsUseCase {
    execute(
        params: IListProjectJobsUseCaseParams
    ): Promise<Result<IListProjectJobsUseCaseData, ListProjectJobsUseCaseError>>;
}

export const ListProjectJobsUseCase = createAbstraction<IListProjectJobsUseCase>(
    "Api/ListProjectJobsUseCase"
);

export namespace ListProjectJobsUseCase {
    export type Interface = IListProjectJobsUseCase;
    export type Params = IListProjectJobsUseCaseParams;
    export type Data = IListProjectJobsUseCaseData;
    export type Error = ListProjectJobsUseCaseError;
}
