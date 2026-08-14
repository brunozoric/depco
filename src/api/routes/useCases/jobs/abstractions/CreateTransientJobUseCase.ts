import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError
} from "#shared/index.js";

export interface ICreateTransientJobUseCaseParams {
    projectId: string;
}

export interface ICreateTransientJobUseCaseData {
    jobId: string;
}

export interface IEnqueueFailedError {
    code: "ENQUEUE_FAILED";
    statusCode: 403;
    message: string;
}

export interface ICreateTransientJobUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    enqueueFailed: IEnqueueFailedError;
    unexpected: IUnexpectedError;
}

type CreateTransientJobUseCaseError =
    ICreateTransientJobUseCaseErrors[keyof ICreateTransientJobUseCaseErrors];

export interface ICreateTransientJobUseCase {
    execute(
        params: ICreateTransientJobUseCaseParams
    ): Promise<Result<ICreateTransientJobUseCaseData, CreateTransientJobUseCaseError>>;
}

export const CreateTransientJobUseCase = createAbstraction<ICreateTransientJobUseCase>(
    "Api/CreateTransientJobUseCase"
);

export namespace CreateTransientJobUseCase {
    export type Interface = ICreateTransientJobUseCase;
    export type Params = ICreateTransientJobUseCaseParams;
    export type Data = ICreateTransientJobUseCaseData;
    export type Error = CreateTransientJobUseCaseError;
}
