import { createAbstraction, Result } from "#shared/index.js";
import type { UpgradeSessionService } from "#api/services/UpgradeSession/index.js";

export interface IExecuteUpgradeStepUseCaseParams {
    projectId: string;
    sessionId: string;
    stepType: string;
    input: Record<string, unknown>;
}

export type IExecuteUpgradeStepUseCaseData = UpgradeSessionService.Row;

export interface ISessionOperationError {
    statusCode: number;
    message: string;
}

export interface IExecuteUpgradeStepUseCaseErrors {
    sessionError: ISessionOperationError;
}

type ExecuteUpgradeStepUseCaseError =
    IExecuteUpgradeStepUseCaseErrors[keyof IExecuteUpgradeStepUseCaseErrors];

export interface IExecuteUpgradeStepUseCase {
    execute(
        params: IExecuteUpgradeStepUseCaseParams
    ): Promise<Result<IExecuteUpgradeStepUseCaseData, ExecuteUpgradeStepUseCaseError>>;
}

export const ExecuteUpgradeStepUseCase = createAbstraction<IExecuteUpgradeStepUseCase>(
    "Api/ExecuteUpgradeStepUseCase"
);

export namespace ExecuteUpgradeStepUseCase {
    export type Interface = IExecuteUpgradeStepUseCase;
    export type Params = IExecuteUpgradeStepUseCaseParams;
    export type Data = IExecuteUpgradeStepUseCaseData;
    export type Error = ExecuteUpgradeStepUseCaseError;
}
