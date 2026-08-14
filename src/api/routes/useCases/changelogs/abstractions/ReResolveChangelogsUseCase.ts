import { createAbstraction, Result } from "#shared/index.js";
import type { ChangelogService } from "#api/services/Changelog/index.js";

export interface IReResolveChangelogsUseCaseParams {
    packageName: string;
    from: string;
    to: string;
}

export interface IReResolveChangelogsUseCaseData {
    items: ChangelogService.Entry[];
    total: number;
    resolving: boolean;
}

export interface IReResolveChangelogsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IReResolveChangelogsUseCase {
    execute(
        params: IReResolveChangelogsUseCaseParams
    ): Promise<Result<IReResolveChangelogsUseCaseData, IReResolveChangelogsUseCaseError>>;
}

export const ReResolveChangelogsUseCase = createAbstraction<IReResolveChangelogsUseCase>(
    "Api/ReResolveChangelogsUseCase"
);

export namespace ReResolveChangelogsUseCase {
    export type Interface = IReResolveChangelogsUseCase;
    export type Params = IReResolveChangelogsUseCaseParams;
    export type Data = IReResolveChangelogsUseCaseData;
    export type Error = IReResolveChangelogsUseCaseError;
}
