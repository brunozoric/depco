import { createAbstraction, Result } from "#shared/index.js";
import type { AutoFixSettingsService } from "#api/services/AutoFix/index.js";

export interface IGetAutoFixSettingsUseCaseParams {
    projectId: string;
}

export interface IGetAutoFixSettingsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetAutoFixSettingsUseCase {
    execute(
        params: IGetAutoFixSettingsUseCaseParams
    ): Promise<Result<AutoFixSettingsService.Settings, IGetAutoFixSettingsUseCaseError>>;
}

export const GetAutoFixSettingsUseCase = createAbstraction<IGetAutoFixSettingsUseCase>(
    "Api/GetAutoFixSettingsUseCase"
);

export namespace GetAutoFixSettingsUseCase {
    export type Interface = IGetAutoFixSettingsUseCase;
    export type Params = IGetAutoFixSettingsUseCaseParams;
    export type Data = AutoFixSettingsService.Settings;
    export type Error = IGetAutoFixSettingsUseCaseError;
}
