import { createAbstraction, Result } from "#shared/index.js";
import type { EngineService } from "#api/services/Engine/index.js";

export interface IScanProjectEnginesUseCaseParams {
    projectId: string;
    warnMaintenance?: boolean;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
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
