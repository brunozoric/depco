import { createAbstraction, Result } from "#shared/index.js";
import type { IAppSettingItem } from "../appSettingsHelper.js";

export interface IUpsertAppSettingUseCaseParams {
    key: string;
    value: string;
}

export type IUpsertAppSettingUseCaseData = IAppSettingItem;

export interface IEncryptionUnavailableError {
    code: "ENCRYPTION_UNAVAILABLE";
    statusCode: 400;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IUpsertAppSettingUseCaseErrors {
    encryptionUnavailable: IEncryptionUnavailableError;
    unexpected: IUnexpectedError;
}

type UpsertAppSettingUseCaseError =
    IUpsertAppSettingUseCaseErrors[keyof IUpsertAppSettingUseCaseErrors];

export interface IUpsertAppSettingUseCase {
    execute(
        params: IUpsertAppSettingUseCaseParams
    ): Promise<Result<IUpsertAppSettingUseCaseData, UpsertAppSettingUseCaseError>>;
}

export const UpsertAppSettingUseCase = createAbstraction<IUpsertAppSettingUseCase>(
    "Api/UpsertAppSettingUseCase"
);

export namespace UpsertAppSettingUseCase {
    export type Interface = IUpsertAppSettingUseCase;
    export type Params = IUpsertAppSettingUseCaseParams;
    export type Data = IUpsertAppSettingUseCaseData;
    export type Error = UpsertAppSettingUseCaseError;
}
