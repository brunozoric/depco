import { createAbstraction, Result } from "#shared/index.js";
import type { IBackupPayload, IImportBackupResult } from "../backupTypes.js";

export interface IImportBackupUseCaseParams {
    payload: IBackupPayload;
}

export interface IImportBackupUseCaseError {
    statusCode: number;
    message: string;
}

export interface IImportBackupUseCase {
    execute(
        params: IImportBackupUseCaseParams
    ): Promise<Result<IImportBackupResult, IImportBackupUseCaseError>>;
}

export const ImportBackupUseCase =
    createAbstraction<IImportBackupUseCase>("Api/ImportBackupUseCase");

export namespace ImportBackupUseCase {
    export type Interface = IImportBackupUseCase;
    export type Params = IImportBackupUseCaseParams;
    export type Data = IImportBackupResult;
    export type Error = IImportBackupUseCaseError;
}
