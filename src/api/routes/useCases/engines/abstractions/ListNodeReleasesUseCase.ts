import { createAbstraction, Result } from "#shared/index.js";
import type { INodeRelease } from "#shared/engines/types.js";

export interface IListNodeReleasesUseCaseParams {}

export interface IListNodeReleasesUseCaseData {
    items: INodeRelease[];
    total: number;
}

export interface IListNodeReleasesUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListNodeReleasesUseCase {
    execute(
        params: IListNodeReleasesUseCaseParams
    ): Promise<Result<IListNodeReleasesUseCaseData, IListNodeReleasesUseCaseError>>;
}

export const ListNodeReleasesUseCase = createAbstraction<IListNodeReleasesUseCase>(
    "Api/ListNodeReleasesUseCase"
);

export namespace ListNodeReleasesUseCase {
    export type Interface = IListNodeReleasesUseCase;
    export type Params = IListNodeReleasesUseCaseParams;
    export type Data = IListNodeReleasesUseCaseData;
    export type Error = IListNodeReleasesUseCaseError;
}
