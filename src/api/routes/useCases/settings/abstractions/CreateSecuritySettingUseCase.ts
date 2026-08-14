import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface ICreateSecuritySettingUseCaseParams {
    packageManager: string;
    fieldName: string;
    expectedValue: string;
}

export type ICreateSecuritySettingUseCaseData = ISecuritySettingResponse;

export interface IUnknownPackageManagerError {
    code: "UNKNOWN_PACKAGE_MANAGER";
    statusCode: 400;
    message: string;
}

export interface IUnknownFieldError {
    code: "UNKNOWN_FIELD";
    statusCode: 400;
    message: string;
}

export interface IInvalidExpectedValueError {
    code: "INVALID_EXPECTED_VALUE";
    statusCode: 400;
    message: string;
}

export interface ISettingConflictError {
    code: "SETTING_CONFLICT";
    statusCode: 409;
    message: string;
}

export interface ICreateSecuritySettingUseCaseErrors {
    unknownPackageManager: IUnknownPackageManagerError;
    unknownField: IUnknownFieldError;
    invalidExpectedValue: IInvalidExpectedValueError;
    settingConflict: ISettingConflictError;
    unexpected: IUnexpectedError;
}

type CreateSecuritySettingUseCaseError =
    ICreateSecuritySettingUseCaseErrors[keyof ICreateSecuritySettingUseCaseErrors];

export interface ICreateSecuritySettingUseCase {
    execute(
        params: ICreateSecuritySettingUseCaseParams
    ): Promise<Result<ICreateSecuritySettingUseCaseData, CreateSecuritySettingUseCaseError>>;
}

export const CreateSecuritySettingUseCase = createAbstraction<ICreateSecuritySettingUseCase>(
    "Api/CreateSecuritySettingUseCase"
);

export namespace CreateSecuritySettingUseCase {
    export type Interface = ICreateSecuritySettingUseCase;
    export type Params = ICreateSecuritySettingUseCaseParams;
    export type Data = ICreateSecuritySettingUseCaseData;
    export type Error = CreateSecuritySettingUseCaseError;
}
