import { createAbstraction, Result } from "#shared/index.js";

export interface IScanProjectLicensesUseCaseParams {
    projectId: string;
}

export interface IScanProjectLicensesUseCaseData {
    jobId: string;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IScanProjectLicensesUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type ScanProjectLicensesUseCaseError =
    IScanProjectLicensesUseCaseErrors[keyof IScanProjectLicensesUseCaseErrors];

export interface IScanProjectLicensesUseCase {
    execute(
        params: IScanProjectLicensesUseCaseParams
    ): Promise<Result<IScanProjectLicensesUseCaseData, ScanProjectLicensesUseCaseError>>;
}

export const ScanProjectLicensesUseCase = createAbstraction<IScanProjectLicensesUseCase>(
    "Api/ScanProjectLicensesUseCase"
);

export namespace ScanProjectLicensesUseCase {
    export type Interface = IScanProjectLicensesUseCase;
    export type Params = IScanProjectLicensesUseCaseParams;
    export type Data = IScanProjectLicensesUseCaseData;
    export type Error = ScanProjectLicensesUseCaseError;
}
