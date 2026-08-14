import { createAbstraction, Result } from "#shared/index.js";
import type { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";

export interface IGetUpgradeSessionUseCaseParams {
    projectId: string;
    sessionId: string;
}

export type IGetUpgradeSessionUseCaseData = UpgradeSessionService.Row;

export interface ISessionNotFoundError {
    code: "SESSION_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface ISessionOperationError {
    code: "SESSION_OPERATION";
    statusCode: number;
    message: string;
}

export interface IGetUpgradeSessionUseCaseErrors {
    sessionNotFound: ISessionNotFoundError;
    sessionError: ISessionOperationError;
}

type GetUpgradeSessionUseCaseError =
    IGetUpgradeSessionUseCaseErrors[keyof IGetUpgradeSessionUseCaseErrors];

export interface IGetUpgradeSessionUseCase {
    execute(
        params: IGetUpgradeSessionUseCaseParams
    ): Promise<Result<IGetUpgradeSessionUseCaseData, GetUpgradeSessionUseCaseError>>;
}

export const GetUpgradeSessionUseCase = createAbstraction<IGetUpgradeSessionUseCase>(
    "Api/GetUpgradeSessionUseCase"
);

export namespace GetUpgradeSessionUseCase {
    export type Interface = IGetUpgradeSessionUseCase;
    export type Params = IGetUpgradeSessionUseCaseParams;
    export type Data = IGetUpgradeSessionUseCaseData;
    export type Error = GetUpgradeSessionUseCaseError;
}
