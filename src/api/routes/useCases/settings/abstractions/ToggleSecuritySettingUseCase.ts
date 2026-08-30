import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type ISettingNotFoundError
} from "#shared/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface IToggleSecuritySettingUseCaseParams {
    id: string;
}

export type IToggleSecuritySettingUseCaseData = ISecuritySettingResponse;

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
