import { createAbstraction } from "#shared/index.js";

export interface IPackageListFilters {
    search?: string | undefined;
    upgradeType?: string | undefined;
    dependencyKind?: string | undefined;
    projectId?: string | undefined;
    hasChangelog?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: string | undefined;
    teamId?: string | undefined;
}

export interface IPackageListProject {
    projectId: string;
    projectName: string;
    currentVersion: string;
    latestVersion: string | null;
    upgradeType: string | null;
}

export interface IPackageListItem {
    name: string;
    projects: IPackageListProject[];
    resolvedChangelogCount: number;
    totalChangelogCount: number;
    lastPublishedAt: number | null;
    dependencyKind: string;
    registryResolved: boolean;
}

export interface IPackageListResult {
    items: IPackageListItem[];
    total: number;
}

export interface IPackageDetailProject {
    projectId: string;
    projectName: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: string;
    dependencyKind: string;
}

export interface IPackageDetail {
    name: string;
    repoUrl: string | null;
    projects: IPackageDetailProject[];
    latestVersion: string | null;
    lastPublishedAt: number | null;
    registryResolved: boolean;
}

export interface IPackageQueryService {
    listPackages(filters: IPackageListFilters): Promise<IPackageListResult>;
    getPackageDetail(packageName: string): Promise<IPackageDetail | null>;
}

export const PackageQueryService =
    createAbstraction<IPackageQueryService>("Api/PackageQueryService");

export namespace PackageQueryService {
    export type Interface = IPackageQueryService;
    export type ListFilters = IPackageListFilters;
    export type ListProject = IPackageListProject;
    export type ListItem = IPackageListItem;
    export type ListResult = IPackageListResult;
    export type DetailProject = IPackageDetailProject;
    export type Detail = IPackageDetail;
}
