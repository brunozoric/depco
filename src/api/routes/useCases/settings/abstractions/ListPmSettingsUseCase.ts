import { createAbstraction, Result } from "#shared/index.js";
import type { FileConfigService } from "#api/services/FileConfig/index.js";
import type { IPmConfigItemResponse } from "../pmConfigHelper.js";

export interface IListPmSettingsUseCaseParams {}

export interface IListPmSettingsUseCaseData {
    items: IPmConfigItemResponse[];
    configSource: "db" | "file" | "error";
    fileManagedPms: string[];
    configError?: FileConfigService.ConfigError;
}

export interface IListPmSettingsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IListPmSettingsUseCase {
    execute(
        params: IListPmSettingsUseCaseParams
    ): Promise<Result<IListPmSettingsUseCaseData, IListPmSettingsUseCaseError>>;
}

export const ListPmSettingsUseCase = createAbstraction<IListPmSettingsUseCase>(
    "Api/ListPmSettingsUseCase"
);

export namespace ListPmSettingsUseCase {
    export type Interface = IListPmSettingsUseCase;
    export type Params = IListPmSettingsUseCaseParams;
    export type Data = IListPmSettingsUseCaseData;
    export type Error = IListPmSettingsUseCaseError;
}
