import { createAbstraction, Result } from "#shared/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface ICreateSecuritySettingUseCaseParams {
    packageManager: string;
    fieldName: string;
    expectedValue: string;
}

export type ICreateSecuritySettingUseCaseData = ISecuritySettingResponse;

export interface IUnknownPackageManagerError {
    statusCode: 400;
    message: string;
}

export interface IUnknownFieldError {
    statusCode: 400;
    message: string;
}

export interface IInvalidExpectedValueError {
    statusCode: 400;
    message: string;
}

export interface ISettingConflictError {
    statusCode: 409;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
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
