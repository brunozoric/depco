import { createAbstraction, Result } from "#shared/index.js";
import type { IJobFilters } from "../jobConditions.js";

export type IDeleteJobsUseCaseParams = IJobFilters;

export interface IDeleteJobsUseCaseData {
    deleted: number;
}

export interface IDeleteJobsUseCaseError {
    statusCode: number;
    message: string;
}

export interface IDeleteJobsUseCase {
    execute(
        params: IDeleteJobsUseCaseParams
    ): Promise<Result<IDeleteJobsUseCaseData, IDeleteJobsUseCaseError>>;
}

export const DeleteJobsUseCase = createAbstraction<IDeleteJobsUseCase>("Api/DeleteJobsUseCase");

export namespace DeleteJobsUseCase {
    export type Interface = IDeleteJobsUseCase;
    export type Params = IDeleteJobsUseCaseParams;
    export type Data = IDeleteJobsUseCaseData;
    export type Error = IDeleteJobsUseCaseError;
}
