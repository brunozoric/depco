import { createAbstraction, Result } from "#shared/index.js";
import type { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";

export interface IAbortUpgradeSessionUseCaseParams {
    projectId: string;
    sessionId: string;
}

export type IAbortUpgradeSessionUseCaseData = UpgradeSessionService.Row;

export interface ISessionOperationError {
    statusCode: number;
    message: string;
}

export interface IAbortUpgradeSessionUseCaseErrors {
    sessionError: ISessionOperationError;
}

type AbortUpgradeSessionUseCaseError =
    IAbortUpgradeSessionUseCaseErrors[keyof IAbortUpgradeSessionUseCaseErrors];

export interface IAbortUpgradeSessionUseCase {
    execute(
        params: IAbortUpgradeSessionUseCaseParams
    ): Promise<Result<IAbortUpgradeSessionUseCaseData, AbortUpgradeSessionUseCaseError>>;
}

export const AbortUpgradeSessionUseCase = createAbstraction<IAbortUpgradeSessionUseCase>(
    "Api/AbortUpgradeSessionUseCase"
);

export namespace AbortUpgradeSessionUseCase {
    export type Interface = IAbortUpgradeSessionUseCase;
    export type Params = IAbortUpgradeSessionUseCaseParams;
    export type Data = IAbortUpgradeSessionUseCaseData;
    export type Error = AbortUpgradeSessionUseCaseError;
}
