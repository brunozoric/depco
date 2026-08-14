import { createAbstraction, Result } from "#shared/index.js";

export interface IScanProjectUseCaseParams {
    id: string;
    force?: string | undefined;
}

export interface IScanProjectUseCaseData {
    jobId: string;
}

export interface IProjectNotFoundError {
    code: "PROJECT_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IScanProjectUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type ScanProjectUseCaseError = IScanProjectUseCaseErrors[keyof IScanProjectUseCaseErrors];

export interface IScanProjectUseCase {
    execute(
        params: IScanProjectUseCaseParams
    ): Promise<Result<IScanProjectUseCaseData, ScanProjectUseCaseError>>;
}

export const ScanProjectUseCase = createAbstraction<IScanProjectUseCase>("Api/ScanProjectUseCase");

export namespace ScanProjectUseCase {
    export type Interface = IScanProjectUseCase;
    export type Params = IScanProjectUseCaseParams;
    export type Data = IScanProjectUseCaseData;
    export type Error = ScanProjectUseCaseError;
}
