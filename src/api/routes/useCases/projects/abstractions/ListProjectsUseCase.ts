import { createAbstraction, Result } from "#shared/index.js";
import type { SecurityService } from "#api/services/Security/index.js";

export interface IListProjectsUseCaseParams {
    page?: number | undefined;
    pageSize?: number | undefined;
    search?: string | undefined;
    teamId?: string | undefined;
}

export interface IProjectTeamBadge {
    id: string;
    name: string;
    color: string;
}

export interface IProjectListItem {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    security: SecurityService.CheckResult | null;
    hasNodeModules: boolean;
    teams: IProjectTeamBadge[];
}

export interface IListProjectsUseCaseData {
    items: IProjectListItem[];
    total: number;
}

export interface IListProjectsUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListProjectsUseCase {
    execute(
        params: IListProjectsUseCaseParams
    ): Promise<Result<IListProjectsUseCaseData, IListProjectsUseCaseError>>;
}

export const ListProjectsUseCase =
    createAbstraction<IListProjectsUseCase>("Api/ListProjectsUseCase");

export namespace ListProjectsUseCase {
    export type Interface = IListProjectsUseCase;
    export type Params = IListProjectsUseCaseParams;
    export type TeamBadge = IProjectTeamBadge;
    export type ListItem = IProjectListItem;
    export type Data = IListProjectsUseCaseData;
    export type Error = IListProjectsUseCaseError;
}
