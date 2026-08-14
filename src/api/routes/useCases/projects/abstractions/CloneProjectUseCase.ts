import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";

export interface ICloneProjectUseCaseParams {
    url: string;
    destination: string;
    folderName?: string | undefined;
}

export interface ICloneProjectUseCaseData {
    jobId: string;
}

export interface IInvalidUrlError {
    code: "INVALID_URL";
    statusCode: 400;
    message: string;
}

export interface IRepoNameExtractionFailedError {
    code: "REPO_NAME_EXTRACTION_FAILED";
    statusCode: 400;
    message: string;
}

export interface IInvalidFolderNameError {
    code: "INVALID_FOLDER_NAME";
    statusCode: 400;
    message: string;
}

export interface IDestinationNotFoundError {
    code: "DESTINATION_NOT_FOUND";
    statusCode: 400;
    message: string;
}

export interface IProjectAlreadyRegisteredError {
    code: "PROJECT_ALREADY_REGISTERED";
    statusCode: 409;
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
