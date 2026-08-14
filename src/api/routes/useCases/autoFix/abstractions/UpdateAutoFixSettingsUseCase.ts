import { createAbstraction, Result } from "#shared/index.js";
import type { AutoFixSettingsService } from "#api/services/AutoFix/index.js";

export interface IUpdateAutoFixSettingsUseCaseParams {
    projectId: string;
    input: AutoFixSettingsService.UpdateInput;
}

export interface IUpdateAutoFixSettingsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IUpdateAutoFixSettingsUseCase {
    execute(
        params: IUpdateAutoFixSettingsUseCaseParams
    ): Promise<Result<AutoFixSettingsService.Settings, IUpdateAutoFixSettingsUseCaseError>>;
}

export const UpdateAutoFixSettingsUseCase = createAbstraction<IUpdateAutoFixSettingsUseCase>(
    "Api/UpdateAutoFixSettingsUseCase"
);

export namespace UpdateAutoFixSettingsUseCase {
    export type Interface = IUpdateAutoFixSettingsUseCase;
    export type Params = IUpdateAutoFixSettingsUseCaseParams;
    export type Data = AutoFixSettingsService.Settings;
    export type Error = IUpdateAutoFixSettingsUseCaseError;
}
