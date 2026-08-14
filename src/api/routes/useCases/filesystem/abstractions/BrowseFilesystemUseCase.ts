import { createAbstraction, Result } from "#shared/index.js";

export interface IBrowseFilesystemUseCaseParams {
    path?: string | undefined;
    showHidden?: string | undefined;
}

export interface IFilesystemDirectoryEntry {
    name: string;
    path: string;
    type: "directory";
}

export interface IBrowseFilesystemUseCaseData {
    items: IFilesystemDirectoryEntry[];
    total: number;
    currentPath: string;
}

export interface IPathNotFoundError {
    code: "PATH_NOT_FOUND";
    statusCode: 400;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IBrowseFilesystemUseCaseErrors {
    pathNotFound: IPathNotFoundError;
    unexpected: IUnexpectedError;
}

type BrowseFilesystemUseCaseError =
    IBrowseFilesystemUseCaseErrors[keyof IBrowseFilesystemUseCaseErrors];

export interface IBrowseFilesystemUseCase {
    execute(
        params: IBrowseFilesystemUseCaseParams
    ): Promise<Result<IBrowseFilesystemUseCaseData, BrowseFilesystemUseCaseError>>;
}

export const BrowseFilesystemUseCase = createAbstraction<IBrowseFilesystemUseCase>(
    "Api/BrowseFilesystemUseCase"
);

export namespace BrowseFilesystemUseCase {
    export type Interface = IBrowseFilesystemUseCase;
    export type Params = IBrowseFilesystemUseCaseParams;
    export type DirectoryEntry = IFilesystemDirectoryEntry;
    export type Data = IBrowseFilesystemUseCaseData;
    export type Error = BrowseFilesystemUseCaseError;
}
