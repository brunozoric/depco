import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IUnknownPackageManagerError
} from "#shared/index.js";
import type { PackageManagerDriver } from "#api/services/PackageManager/abstractions/PackageManagerDriver.js";

export interface IGetInstallOptionsUseCaseParams {
    packageManager: string;
}

export interface IGetInstallOptionsUseCaseData {
    items: PackageManagerDriver.InstallFlagDefinition[];
    total: number;
}

export interface IGetInstallOptionsUseCaseErrors {
    unknownPackageManager: IUnknownPackageManagerError;
    unexpected: IUnexpectedError;
}

type GetInstallOptionsUseCaseError =
    IGetInstallOptionsUseCaseErrors[keyof IGetInstallOptionsUseCaseErrors];

export interface IGetInstallOptionsUseCase {
    execute(
        params: IGetInstallOptionsUseCaseParams
    ): Promise<Result<IGetInstallOptionsUseCaseData, GetInstallOptionsUseCaseError>>;
}

export const GetInstallOptionsUseCase = createAbstraction<IGetInstallOptionsUseCase>(
    "Api/GetInstallOptionsUseCase"
);

export namespace GetInstallOptionsUseCase {
    export type Interface = IGetInstallOptionsUseCase;
    export type Params = IGetInstallOptionsUseCaseParams;
    export type Data = IGetInstallOptionsUseCaseData;
    export type Error = GetInstallOptionsUseCaseError;
}
