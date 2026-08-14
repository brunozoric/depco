import { createAbstraction, Result } from "#shared/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface IToggleSecuritySettingUseCaseParams {
    id: string;
}

export type IToggleSecuritySettingUseCaseData = ISecuritySettingResponse;

export interface ISettingNotFoundError {
    code: "SETTING_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IToggleSecuritySettingUseCaseErrors {
    notFound: ISettingNotFoundError;
    unexpected: IUnexpectedError;
}

type ToggleSecuritySettingUseCaseError =
    IToggleSecuritySettingUseCaseErrors[keyof IToggleSecuritySettingUseCaseErrors];

export interface IToggleSecuritySettingUseCase {
    execute(
        params: IToggleSecuritySettingUseCaseParams
    ): Promise<Result<IToggleSecuritySettingUseCaseData, ToggleSecuritySettingUseCaseError>>;
}

export const ToggleSecuritySettingUseCase = createAbstraction<IToggleSecuritySettingUseCase>(
    "Api/ToggleSecuritySettingUseCase"
);

export namespace ToggleSecuritySettingUseCase {
    export type Interface = IToggleSecuritySettingUseCase;
    export type Params = IToggleSecuritySettingUseCaseParams;
    export type Data = IToggleSecuritySettingUseCaseData;
    export type Error = ToggleSecuritySettingUseCaseError;
}
