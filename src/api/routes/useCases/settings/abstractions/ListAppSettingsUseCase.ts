import { createAbstraction, Result } from "#shared/index.js";
import type { FileConfigService } from "#api/services/FileConfig/index.js";
import type { IAppSettingItem } from "../appSettingsHelper.js";

export interface IListAppSettingsUseCaseParams {}

export interface IListAppSettingsUseCaseData {
    items: IAppSettingItem[];
    total: number;
    configSource: "db" | "file" | "error";
    fileManaged: string[];
    configError?: FileConfigService.ConfigError;
    encryptionAvailable: boolean;
}

export interface IListAppSettingsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListAppSettingsUseCase {
    execute(
        params: IListAppSettingsUseCaseParams
    ): Promise<Result<IListAppSettingsUseCaseData, IListAppSettingsUseCaseError>>;
}

export const ListAppSettingsUseCase = createAbstraction<IListAppSettingsUseCase>(
    "Api/ListAppSettingsUseCase"
);

export namespace ListAppSettingsUseCase {
    export type Interface = IListAppSettingsUseCase;
    export type Params = IListAppSettingsUseCaseParams;
    export type Data = IListAppSettingsUseCaseData;
    export type Error = IListAppSettingsUseCaseError;
}
