import { createAbstraction, Result } from "#shared/index.js";

export interface ICancelJobUseCaseParams {
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

export interface ICancelJobUseCaseErrors {
    jobNotFound: IJobNotFoundError;
    unexpected: IUnexpectedError;
}

type CancelJobUseCaseError = ICancelJobUseCaseErrors[keyof ICancelJobUseCaseErrors];

export interface ICancelJobUseCase {
    execute(params: ICancelJobUseCaseParams): Promise<Result<void, CancelJobUseCaseError>>;
}

export const CancelJobUseCase = createAbstraction<ICancelJobUseCase>("Api/CancelJobUseCase");

export namespace CancelJobUseCase {
    export type Interface = ICancelJobUseCase;
    export type Params = ICancelJobUseCaseParams;
    export type Error = CancelJobUseCaseError;
}
