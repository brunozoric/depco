import { createAbstraction, Result } from "#shared/index.js";

export interface IDeleteAutoFixPullRequestUseCaseParams {
    id: string;
}

export interface IDeleteAutoFixPullRequestUseCaseData {
    deleted: boolean;
}

export interface IDeleteAutoFixPullRequestUseCaseError {
    statusCode: number;
    message: string;
}

export interface IDeleteAutoFixPullRequestUseCase {
    execute(
        params: IDeleteAutoFixPullRequestUseCaseParams
    ): Promise<Result<IDeleteAutoFixPullRequestUseCaseData, IDeleteAutoFixPullRequestUseCaseError>>;
}

export const DeleteAutoFixPullRequestUseCase = createAbstraction<IDeleteAutoFixPullRequestUseCase>(
    "Api/DeleteAutoFixPullRequestUseCase"
);

export namespace DeleteAutoFixPullRequestUseCase {
    export type Interface = IDeleteAutoFixPullRequestUseCase;
    export type Params = IDeleteAutoFixPullRequestUseCaseParams;
    export type Data = IDeleteAutoFixPullRequestUseCaseData;
    export type Error = IDeleteAutoFixPullRequestUseCaseError;
}
