import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";

export interface IScanFilesystemUseCaseParams {
    path: string;
    depth: number;
}

export interface IScanFilesystemItem {
    name: string;
    path: string;
}

export interface IScanFilesystemUseCaseData {
    items: IScanFilesystemItem[];
    total: number;
    scannedPath: string;
    scannedCount: number;
    filteredCount: number;
    mode: "workspaces" | "depth";
}

export interface IPathNotFoundError {
    code: "PATH_NOT_FOUND";
    statusCode: 400;
    message: string;
}

export interface IScanFilesystemUseCaseErrors {
    pathNotFound: IPathNotFoundError;
    unexpected: IUnexpectedError;
}

type ScanFilesystemUseCaseError = IScanFilesystemUseCaseErrors[keyof IScanFilesystemUseCaseErrors];

export interface IScanFilesystemUseCase {
    execute(
        params: IScanFilesystemUseCaseParams
    ): Promise<Result<IScanFilesystemUseCaseData, ScanFilesystemUseCaseError>>;
}

export const ScanFilesystemUseCase = createAbstraction<IScanFilesystemUseCase>(
    "Api/ScanFilesystemUseCase"
);

export namespace ScanFilesystemUseCase {
    export type Interface = IScanFilesystemUseCase;
    export type Params = IScanFilesystemUseCaseParams;
    export type Item = IScanFilesystemItem;
    export type Data = IScanFilesystemUseCaseData;
    export type Error = ScanFilesystemUseCaseError;
}
