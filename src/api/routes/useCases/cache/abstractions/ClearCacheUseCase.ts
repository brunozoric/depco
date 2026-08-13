import { createAbstraction, Result } from "#shared/index.js";

export interface IClearCacheUseCaseParams {}

export interface IClearCacheUseCaseData {
    success: true;
}

export interface IClearCacheUseCaseError {
    statusCode: number;
    message: string;
}

export interface IClearCacheUseCase {
    execute(
        params: IClearCacheUseCaseParams
    ): Promise<Result<IClearCacheUseCaseData, IClearCacheUseCaseError>>;
}

export const ClearCacheUseCase = createAbstraction<IClearCacheUseCase>("Api/ClearCacheUseCase");

export namespace ClearCacheUseCase {
    export type Interface = IClearCacheUseCase;
    export type Params = IClearCacheUseCaseParams;
    export type Data = IClearCacheUseCaseData;
    export type Error = IClearCacheUseCaseError;
}
