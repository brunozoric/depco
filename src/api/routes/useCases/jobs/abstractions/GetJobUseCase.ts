import { createAbstraction, Result } from "#shared/index.js";
import type { JobWorker } from "#api/services/JobExecution/index.js";

export interface IGetJobUseCaseParams {
    projectId: string;
    jobId: string;
}

export interface IJobNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IGetJobUseCaseErrors {
    jobNotFound: IJobNotFoundError;
    unexpected: IUnexpectedError;
}

type GetJobUseCaseError = IGetJobUseCaseErrors[keyof IGetJobUseCaseErrors];

export interface IGetJobUseCase {
    execute(params: IGetJobUseCaseParams): Promise<Result<JobWorker.Job, GetJobUseCaseError>>;
}

export const GetJobUseCase = createAbstraction<IGetJobUseCase>("Api/GetJobUseCase");

export namespace GetJobUseCase {
    export type Interface = IGetJobUseCase;
    export type Params = IGetJobUseCaseParams;
    export type Data = JobWorker.Job;
    export type Error = GetJobUseCaseError;
}
