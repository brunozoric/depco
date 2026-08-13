import { createAbstraction, Result } from "#shared/index.js";

export interface IReResolveAllChangelogsUseCaseParams {}

export interface IReResolveAllChangelogsUseCaseData {
    packageCount: number;
}

export interface IReResolveAllChangelogsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IReResolveAllChangelogsUseCase {
    execute(
        params: IReResolveAllChangelogsUseCaseParams
    ): Promise<Result<IReResolveAllChangelogsUseCaseData, IReResolveAllChangelogsUseCaseError>>;
}

export const ReResolveAllChangelogsUseCase = createAbstraction<IReResolveAllChangelogsUseCase>(
    "Api/ReResolveAllChangelogsUseCase"
);

export namespace ReResolveAllChangelogsUseCase {
    export type Interface = IReResolveAllChangelogsUseCase;
    export type Params = IReResolveAllChangelogsUseCaseParams;
    export type Data = IReResolveAllChangelogsUseCaseData;
    export type Error = IReResolveAllChangelogsUseCaseError;
}
