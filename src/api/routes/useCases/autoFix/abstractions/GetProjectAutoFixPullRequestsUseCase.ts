import { createAbstraction, Result } from "#shared/index.js";
import type { IAutoFixPullRequestListItem } from "../autoFixPullRequestMapper.js";

export interface IGetProjectAutoFixPullRequestsUseCaseParams {
    projectId: string;
    status?: string | undefined;
}

export interface IGetProjectAutoFixPullRequestsUseCaseData {
    items: IAutoFixPullRequestListItem[];
    total: number;
}

export interface IGetProjectAutoFixPullRequestsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetProjectAutoFixPullRequestsUseCase {
    execute(
        params: IGetProjectAutoFixPullRequestsUseCaseParams
    ): Promise<
        Result<
            IGetProjectAutoFixPullRequestsUseCaseData,
            IGetProjectAutoFixPullRequestsUseCaseError
        >
    >;
}

export const GetProjectAutoFixPullRequestsUseCase =
    createAbstraction<IGetProjectAutoFixPullRequestsUseCase>(
        "Api/GetProjectAutoFixPullRequestsUseCase"
    );

export namespace GetProjectAutoFixPullRequestsUseCase {
    export type Interface = IGetProjectAutoFixPullRequestsUseCase;
    export type Params = IGetProjectAutoFixPullRequestsUseCaseParams;
    export type Data = IGetProjectAutoFixPullRequestsUseCaseData;
    export type Error = IGetProjectAutoFixPullRequestsUseCaseError;
}
