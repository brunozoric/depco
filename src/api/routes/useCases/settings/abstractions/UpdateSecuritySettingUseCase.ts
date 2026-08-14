import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface IUpdateSecuritySettingUseCaseParams {
    id: string;
    expectedValue: string;
}

export type IUpdateSecuritySettingUseCaseData = ISecuritySettingResponse;

export interface ISettingNotFoundError {
    code: "SETTING_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IInvalidExpectedValueError {
    code: "INVALID_EXPECTED_VALUE";
    statusCode: 400;
    message: string;
}

export interface IUpdateSecuritySettingUseCaseErrors {
    notFound: ISettingNotFoundError;
    invalidExpectedValue: IInvalidExpectedValueError;
    unexpected: IUnexpectedError;
}

type UpdateSecuritySettingUseCaseError =
    IUpdateSecuritySettingUseCaseErrors[keyof IUpdateSecuritySettingUseCaseErrors];

export interface IUpdateSecuritySettingUseCase {
    execute(
        params: IUpdateSecuritySettingUseCaseParams
    ): Promise<Result<IUpdateSecuritySettingUseCaseData, UpdateSecuritySettingUseCaseError>>;
}

export const UpdateSecuritySettingUseCase = createAbstraction<IUpdateSecuritySettingUseCase>(
    "Api/UpdateSecuritySettingUseCase"
);

export namespace UpdateSecuritySettingUseCase {
    export type Interface = IUpdateSecuritySettingUseCase;
    export type Params = IUpdateSecuritySettingUseCaseParams;
    export type Data = IUpdateSecuritySettingUseCaseData;
    export type Error = UpdateSecuritySettingUseCaseError;
}
