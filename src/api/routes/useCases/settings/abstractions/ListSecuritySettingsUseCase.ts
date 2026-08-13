import { createAbstraction, Result } from "#shared/index.js";
import type { FileConfigService } from "#api/services/FileConfig/index.js";
import type { ISecuritySettingResponse } from "../securitySettingsHelper.js";

export interface IListSecuritySettingsUseCaseParams {}

export interface IListSecuritySettingsUseCaseData {
    items: ISecuritySettingResponse[];
    total: number;
    configSource: "db" | "file" | "error";
    fileManagedPms: string[];
    configError?: FileConfigService.ConfigError;
}

export interface IListSecuritySettingsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IListSecuritySettingsUseCase {
    execute(
        params: IListSecuritySettingsUseCaseParams
    ): Promise<Result<IListSecuritySettingsUseCaseData, IListSecuritySettingsUseCaseError>>;
}

export const ListSecuritySettingsUseCase = createAbstraction<IListSecuritySettingsUseCase>(
    "Api/ListSecuritySettingsUseCase"
);

export namespace ListSecuritySettingsUseCase {
    export type Interface = IListSecuritySettingsUseCase;
    export type Params = IListSecuritySettingsUseCaseParams;
    export type Data = IListSecuritySettingsUseCaseData;
    export type Error = IListSecuritySettingsUseCaseError;
}
