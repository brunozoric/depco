import { createAbstraction, Result } from "#shared/index.js";
import type { EngineService } from "#api/services/Engine/index.js";

export interface IGetProjectEngineChecksUseCaseParams {
    projectId: string;
}

export interface IGetProjectEngineChecksUseCaseData {
    items: EngineService.Check[];
    total: number;
}

export interface IGetProjectEngineChecksUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetProjectEngineChecksUseCase {
    execute(
        params: IGetProjectEngineChecksUseCaseParams
    ): Promise<Result<IGetProjectEngineChecksUseCaseData, IGetProjectEngineChecksUseCaseError>>;
}

export const GetProjectEngineChecksUseCase = createAbstraction<IGetProjectEngineChecksUseCase>(
    "Api/GetProjectEngineChecksUseCase"
);

export namespace GetProjectEngineChecksUseCase {
    export type Interface = IGetProjectEngineChecksUseCase;
    export type Params = IGetProjectEngineChecksUseCaseParams;
    export type Data = IGetProjectEngineChecksUseCaseData;
    export type Error = IGetProjectEngineChecksUseCaseError;
}
