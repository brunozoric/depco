import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IUnknownPackageManagerError
} from "#shared/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface IResetSecuritySettingsUseCaseParams {
    packageManager: string;
}

export interface IResetSecuritySettingsUseCaseData {
    items: ISecuritySettingResponse[];
    total: number;
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
