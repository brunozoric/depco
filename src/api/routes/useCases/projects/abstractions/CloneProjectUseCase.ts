import { createAbstraction, Result } from "#shared/index.js";

export interface ICloneProjectUseCaseParams {
    url: string;
    destination: string;
    folderName?: string | undefined;
}

export interface ICloneProjectUseCaseData {
    jobId: string;
}

export interface IInvalidUrlError {
    statusCode: 400;
    message: string;
}

export interface IRepoNameExtractionFailedError {
    statusCode: 400;
    message: string;
}

export interface IInvalidFolderNameError {
    statusCode: 400;
    message: string;
}

export interface IDestinationNotFoundError {
    statusCode: 400;
    message: string;
}

export interface IProjectAlreadyRegisteredError {
    statusCode: 409;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface ICloneProjectUseCaseErrors {
    invalidUrl: IInvalidUrlError;
    repoNameExtractionFailed: IRepoNameExtractionFailedError;
    invalidFolderName: IInvalidFolderNameError;
    destinationNotFound: IDestinationNotFoundError;
    projectAlreadyRegistered: IProjectAlreadyRegisteredError;
    unexpected: IUnexpectedError;
}

type CloneProjectUseCaseError = ICloneProjectUseCaseErrors[keyof ICloneProjectUseCaseErrors];

export interface ICloneProjectUseCase {
    execute(
        params: ICloneProjectUseCaseParams
    ): Promise<Result<ICloneProjectUseCaseData, CloneProjectUseCaseError>>;
}

export const CloneProjectUseCase =
    createAbstraction<ICloneProjectUseCase>("Api/CloneProjectUseCase");

export namespace CloneProjectUseCase {
    export type Interface = ICloneProjectUseCase;
    export type Params = ICloneProjectUseCaseParams;
    export type Data = ICloneProjectUseCaseData;
    export type Error = CloneProjectUseCaseError;
}
