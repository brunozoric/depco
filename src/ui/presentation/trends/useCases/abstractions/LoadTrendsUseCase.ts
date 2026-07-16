import { createAbstraction } from "#shared/index.js";

export interface ILoadTrendsUseCaseRanges {
    staleness?: string;
    license?: string;
    autoFix?: string;
    teamId?: string;
}

export interface ILoadTrendsUseCase {
    execute(ranges: ILoadTrendsUseCaseRanges): Promise<void>;
}

export const LoadTrendsUseCase = createAbstraction<ILoadTrendsUseCase>("Ui/LoadTrendsUseCase");

export namespace LoadTrendsUseCase {
    export type Interface = ILoadTrendsUseCase;
    export type Ranges = ILoadTrendsUseCaseRanges;
}
