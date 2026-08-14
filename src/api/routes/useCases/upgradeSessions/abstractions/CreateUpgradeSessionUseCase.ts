import { createAbstraction, Result } from "#shared/index.js";
import type { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";

export interface ICreateUpgradeSessionUseCaseParams {
    projectId: string;
}

export type ICreateUpgradeSessionUseCaseData = UpgradeSessionService.Row;

export interface ISessionOperationError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface ICreateUpgradeSessionUseCaseErrors {
    sessionError: ISessionOperationError;
}

type CreateUpgradeSessionUseCaseError =
    ICreateUpgradeSessionUseCaseErrors[keyof ICreateUpgradeSessionUseCaseErrors];

export interface ICreateUpgradeSessionUseCase {
    execute(
        params: ICreateUpgradeSessionUseCaseParams
    ): Promise<Result<ICreateUpgradeSessionUseCaseData, CreateUpgradeSessionUseCaseError>>;
}

export const CreateUpgradeSessionUseCase = createAbstraction<ICreateUpgradeSessionUseCase>(
    "Api/CreateUpgradeSessionUseCase"
);

export namespace CreateUpgradeSessionUseCase {
    export type Interface = ICreateUpgradeSessionUseCase;
    export type Params = ICreateUpgradeSessionUseCaseParams;
    export type Data = ICreateUpgradeSessionUseCaseData;
    export type Error = CreateUpgradeSessionUseCaseError;
}
