import { createAbstraction, Result } from "#shared/index.js";

export interface IGetExpiredSnoozesUseCaseParams {
    since: number;
}

export interface IGetExpiredSnoozesUseCaseData {
    count: number;
    packageNames: string[];
}

export interface IGetExpiredSnoozesUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetExpiredSnoozesUseCase {
    execute(
        params: IGetExpiredSnoozesUseCaseParams
    ): Promise<Result<IGetExpiredSnoozesUseCaseData, IGetExpiredSnoozesUseCaseError>>;
}

export const GetExpiredSnoozesUseCase = createAbstraction<IGetExpiredSnoozesUseCase>(
    "Api/GetExpiredSnoozesUseCase"
);

export namespace GetExpiredSnoozesUseCase {
    export type Interface = IGetExpiredSnoozesUseCase;
    export type Params = IGetExpiredSnoozesUseCaseParams;
    export type Data = IGetExpiredSnoozesUseCaseData;
    export type Error = IGetExpiredSnoozesUseCaseError;
}
