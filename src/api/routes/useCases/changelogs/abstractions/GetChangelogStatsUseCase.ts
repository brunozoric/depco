import { createAbstraction, Result } from "#shared/index.js";
import type { ChangelogService } from "#api/services/Changelog/index.js";

export interface IGetChangelogStatsUseCaseParams {}

export type IGetChangelogStatsUseCaseData = ChangelogService.Stats;

export interface IGetChangelogStatsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetChangelogStatsUseCase {
    execute(
        params: IGetChangelogStatsUseCaseParams
    ): Promise<Result<IGetChangelogStatsUseCaseData, IGetChangelogStatsUseCaseError>>;
}

export const GetChangelogStatsUseCase = createAbstraction<IGetChangelogStatsUseCase>(
    "Api/GetChangelogStatsUseCase"
);

export namespace GetChangelogStatsUseCase {
    export type Interface = IGetChangelogStatsUseCase;
    export type Params = IGetChangelogStatsUseCaseParams;
    export type Data = IGetChangelogStatsUseCaseData;
    export type Error = IGetChangelogStatsUseCaseError;
}
