import { createAbstraction, Result } from "#shared/index.js";

export interface IClearPackageCacheUseCaseParams {
    packageName: string;
}

export interface IClearPackageCacheUseCaseData {
    success: true;
}

export interface IClearPackageCacheUseCaseError {
    statusCode: number;
    message: string;
}

export interface IClearPackageCacheUseCase {
    execute(
        params: IClearPackageCacheUseCaseParams
    ): Promise<Result<IClearPackageCacheUseCaseData, IClearPackageCacheUseCaseError>>;
}

export const ClearPackageCacheUseCase = createAbstraction<IClearPackageCacheUseCase>(
    "Api/ClearPackageCacheUseCase"
);

export namespace ClearPackageCacheUseCase {
    export type Interface = IClearPackageCacheUseCase;
    export type Params = IClearPackageCacheUseCaseParams;
    export type Data = IClearPackageCacheUseCaseData;
    export type Error = IClearPackageCacheUseCaseError;
}
