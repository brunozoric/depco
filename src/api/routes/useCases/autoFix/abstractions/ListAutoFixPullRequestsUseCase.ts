import { createAbstraction, Result } from "#shared/index.js";
import type { IAutoFixPullRequestFilters } from "../autoFixPullRequestConditions.js";
import type { IAutoFixPullRequestListItem } from "../autoFixPullRequestMapper.js";

export interface IListAutoFixPullRequestsUseCaseParams extends IAutoFixPullRequestFilters {
    page?: number | undefined;
    pageSize?: number | undefined;
}

export interface IListAutoFixPullRequestsUseCaseData {
    items: IAutoFixPullRequestListItem[];
    total: number;
}

export interface IListAutoFixPullRequestsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListAutoFixPullRequestsUseCase {
    execute(
        params: IListAutoFixPullRequestsUseCaseParams
    ): Promise<Result<IListAutoFixPullRequestsUseCaseData, IListAutoFixPullRequestsUseCaseError>>;
}

export const ListAutoFixPullRequestsUseCase = createAbstraction<IListAutoFixPullRequestsUseCase>(
    "Api/ListAutoFixPullRequestsUseCase"
);

export namespace ListAutoFixPullRequestsUseCase {
    export type Interface = IListAutoFixPullRequestsUseCase;
    export type Params = IListAutoFixPullRequestsUseCaseParams;
    export type Data = IListAutoFixPullRequestsUseCaseData;
    export type Error = IListAutoFixPullRequestsUseCaseError;
}
