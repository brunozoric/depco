import { createAbstraction, Result } from "#shared/index.js";
import type { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";

export interface ISkipUpgradeStepUseCaseParams {
    projectId: string;
    sessionId: string;
    stepType: string;
}

export type ISkipUpgradeStepUseCaseData = UpgradeSessionService.Row;

export interface ISessionOperationError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface ISkipUpgradeStepUseCaseErrors {
    sessionError: ISessionOperationError;
}

type SkipUpgradeStepUseCaseError =
    ISkipUpgradeStepUseCaseErrors[keyof ISkipUpgradeStepUseCaseErrors];

export interface ISkipUpgradeStepUseCase {
    execute(
        params: ISkipUpgradeStepUseCaseParams
    ): Promise<Result<ISkipUpgradeStepUseCaseData, SkipUpgradeStepUseCaseError>>;
}

export const SkipUpgradeStepUseCase = createAbstraction<ISkipUpgradeStepUseCase>(
    "Api/SkipUpgradeStepUseCase"
);

export namespace SkipUpgradeStepUseCase {
    export type Interface = ISkipUpgradeStepUseCase;
    export type Params = ISkipUpgradeStepUseCaseParams;
    export type Data = ISkipUpgradeStepUseCaseData;
    export type Error = SkipUpgradeStepUseCaseError;
}
