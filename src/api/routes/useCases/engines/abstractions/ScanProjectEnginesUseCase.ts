import { createAbstraction, Result } from "#shared/index.js";
import type { EngineService } from "#api/services/Engine/index.js";

export interface IScanProjectEnginesUseCaseParams {
    projectId: string;
    warnMaintenance?: boolean;
}

export interface IProjectNotFoundError {
    code: "PROJECT_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IScanProjectEnginesUseCaseErrors {
    notFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type ScanProjectEnginesUseCaseError =
    IScanProjectEnginesUseCaseErrors[keyof IScanProjectEnginesUseCaseErrors];

export interface IScanProjectEnginesUseCase {
    execute(
        params: IScanProjectEnginesUseCaseParams
    ): Promise<Result<EngineService.ScanResult, ScanProjectEnginesUseCaseError>>;
}

export const ScanProjectEnginesUseCase = createAbstraction<IScanProjectEnginesUseCase>(
    "Api/ScanProjectEnginesUseCase"
);

export namespace ScanProjectEnginesUseCase {
    export type Interface = IScanProjectEnginesUseCase;
    export type Params = IScanProjectEnginesUseCaseParams;
    export type Data = EngineService.ScanResult;
    export type Error = ScanProjectEnginesUseCaseError;
}
