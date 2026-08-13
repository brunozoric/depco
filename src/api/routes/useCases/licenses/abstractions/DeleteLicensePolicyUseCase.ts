import { createAbstraction, Result } from "#shared/index.js";

export interface IDeleteLicensePolicyUseCaseParams {
    id: string;
}

export interface IDeleteLicensePolicyUseCaseData {
    deleted: boolean;
}

export interface IDeleteLicensePolicyUseCaseError {
    statusCode: number;
    message: string;
}

export interface IDeleteLicensePolicyUseCase {
    execute(
        params: IDeleteLicensePolicyUseCaseParams
    ): Promise<Result<IDeleteLicensePolicyUseCaseData, IDeleteLicensePolicyUseCaseError>>;
}

export const DeleteLicensePolicyUseCase = createAbstraction<IDeleteLicensePolicyUseCase>(
    "Api/DeleteLicensePolicyUseCase"
);

export namespace DeleteLicensePolicyUseCase {
    export type Interface = IDeleteLicensePolicyUseCase;
    export type Params = IDeleteLicensePolicyUseCaseParams;
    export type Data = IDeleteLicensePolicyUseCaseData;
    export type Error = IDeleteLicensePolicyUseCaseError;
}
