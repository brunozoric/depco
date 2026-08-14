import { createAbstraction, Result } from "#shared/index.js";
import type { EngineService } from "#api/services/Engine/index.js";

export interface IGetEngineSummaryUseCaseParams {}

export interface IGetEngineSummaryUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetEngineSummaryUseCase {
    execute(
        params: IGetEngineSummaryUseCaseParams
    ): Promise<Result<EngineService.Summary, IGetEngineSummaryUseCaseError>>;
}

export const GetEngineSummaryUseCase = createAbstraction<IGetEngineSummaryUseCase>(
    "Api/GetEngineSummaryUseCase"
);

export namespace GetEngineSummaryUseCase {
    export type Interface = IGetEngineSummaryUseCase;
    export type Params = IGetEngineSummaryUseCaseParams;
    export type Data = EngineService.Summary;
    export type Error = IGetEngineSummaryUseCaseError;
}
