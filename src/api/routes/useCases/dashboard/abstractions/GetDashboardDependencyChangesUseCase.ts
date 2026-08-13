import { createAbstraction, Result } from "#shared/index.js";

export interface IGetDashboardDependencyChangesUseCaseParams {
    projectId?: string | undefined;
    limit: number;
    teamId?: string | undefined;
}

export interface IDashboardDependencyChangeItem {
    id: string;
    projectId: string;
    projectName: string;
    packageName: string;
    changeType: "added" | "removed" | "version-changed";
    previousVersion: string | null;
    newVersion: string | null;
    detectedAt: number;
}

export interface IGetDashboardDependencyChangesUseCaseData {
    items: IDashboardDependencyChangeItem[];
    total: number;
}

export interface IGetDashboardDependencyChangesUseCaseError {
    statusCode: number;
    message: string;
}

export interface IGetDashboardDependencyChangesUseCase {
    execute(
        params: IGetDashboardDependencyChangesUseCaseParams
    ): Promise<
        Result<
            IGetDashboardDependencyChangesUseCaseData,
            IGetDashboardDependencyChangesUseCaseError
        >
    >;
}

export const GetDashboardDependencyChangesUseCase =
    createAbstraction<IGetDashboardDependencyChangesUseCase>(
        "Api/GetDashboardDependencyChangesUseCase"
    );

export namespace GetDashboardDependencyChangesUseCase {
    export type Interface = IGetDashboardDependencyChangesUseCase;
    export type Params = IGetDashboardDependencyChangesUseCaseParams;
    export type Data = IGetDashboardDependencyChangesUseCaseData;
    export type Error = IGetDashboardDependencyChangesUseCaseError;
    export type Item = IDashboardDependencyChangeItem;
}
