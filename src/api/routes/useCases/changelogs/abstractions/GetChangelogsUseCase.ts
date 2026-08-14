import { createAbstraction, Result } from "#shared/index.js";
import type { ChangelogService } from "#api/services/Changelog/index.js";

export interface IGetChangelogsUseCaseParams {
    packageName: string;
    from: string;
    to: string;
}

export interface IGetChangelogsUseCaseData {
    items: ChangelogService.Entry[];
    total: number;
    resolving: boolean;
}

export interface IGetChangelogsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetChangelogsUseCase {
    execute(
        params: IGetChangelogsUseCaseParams
    ): Promise<Result<IGetChangelogsUseCaseData, IGetChangelogsUseCaseError>>;
}

export const GetChangelogsUseCase = createAbstraction<IGetChangelogsUseCase>(
    "Api/GetChangelogsUseCase"
);

export namespace GetChangelogsUseCase {
    export type Interface = IGetChangelogsUseCase;
    export type Params = IGetChangelogsUseCaseParams;
    export type Data = IGetChangelogsUseCaseData;
    export type Error = IGetChangelogsUseCaseError;
}
