import { createAbstraction, Result } from "#shared/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface IResetSecuritySettingsUseCaseParams {
    packageManager: string;
}

export interface IResetSecuritySettingsUseCaseData {
    items: ISecuritySettingResponse[];
    total: number;
}

export interface IUnknownPackageManagerError {
    code: "UNKNOWN_PACKAGE_MANAGER";
    statusCode: 400;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IResetSecuritySettingsUseCaseErrors {
    unknownPackageManager: IUnknownPackageManagerError;
    unexpected: IUnexpectedError;
}

type ResetSecuritySettingsUseCaseError =
    IResetSecuritySettingsUseCaseErrors[keyof IResetSecuritySettingsUseCaseErrors];

export interface IResetSecuritySettingsUseCase {
    execute(
        params: IResetSecuritySettingsUseCaseParams
    ): Promise<Result<IResetSecuritySettingsUseCaseData, ResetSecuritySettingsUseCaseError>>;
}

export const ResetSecuritySettingsUseCase = createAbstraction<IResetSecuritySettingsUseCase>(
    "Api/ResetSecuritySettingsUseCase"
);

export namespace ResetSecuritySettingsUseCase {
    export type Interface = IResetSecuritySettingsUseCase;
    export type Params = IResetSecuritySettingsUseCaseParams;
    export type Data = IResetSecuritySettingsUseCaseData;
    export type Error = ResetSecuritySettingsUseCaseError;
}
