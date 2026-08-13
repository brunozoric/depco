import { createAbstraction, Result } from "#shared/index.js";

export interface IRescanPackageUseCaseParams {
    packageName: string;
}

export interface IRescanPackageUseCaseData {
    updated: number;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IRescanPackageUseCaseErrors {
    unexpected: IUnexpectedError;
}

type RescanPackageUseCaseError = IRescanPackageUseCaseErrors[keyof IRescanPackageUseCaseErrors];

export interface IRescanPackageUseCase {
    execute(
        params: IRescanPackageUseCaseParams
    ): Promise<Result<IRescanPackageUseCaseData, RescanPackageUseCaseError>>;
}

export const RescanPackageUseCase = createAbstraction<IRescanPackageUseCase>(
    "Api/RescanPackageUseCase"
);

export namespace RescanPackageUseCase {
    export type Interface = IRescanPackageUseCase;
    export type Params = IRescanPackageUseCaseParams;
    export type Data = IRescanPackageUseCaseData;
    export type Error = RescanPackageUseCaseError;
}
