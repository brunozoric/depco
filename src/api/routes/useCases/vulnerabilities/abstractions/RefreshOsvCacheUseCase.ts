import { createAbstraction, Result } from "#shared/index.js";
import type { OsvCacheService } from "#api/services/Vulnerability/index.js";

export interface IRefreshOsvCacheUseCaseData {
    invalidated: number;
}

export interface IRefreshOsvCacheUseCaseError {
    statusCode: number;
    message: string;
}

export interface IRefreshOsvCacheUseCase {
    execute(
        params: OsvCacheService.InvalidateOptions
    ): Promise<Result<IRefreshOsvCacheUseCaseData, IRefreshOsvCacheUseCaseError>>;
}

export const RefreshOsvCacheUseCase = createAbstraction<IRefreshOsvCacheUseCase>(
    "Api/RefreshOsvCacheUseCase"
);

export namespace RefreshOsvCacheUseCase {
    export type Interface = IRefreshOsvCacheUseCase;
    export type Params = OsvCacheService.InvalidateOptions;
    export type Data = IRefreshOsvCacheUseCaseData;
    export type Error = IRefreshOsvCacheUseCaseError;
}
