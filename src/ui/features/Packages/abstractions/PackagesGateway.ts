import { createAbstraction } from "#shared/index.js";
import type { IChangelogEntry } from "#shared/changelog/types.js";

export interface IPackageProject {
    projectId: string;
    projectName: string;
    currentVersion: string;
    latestVersion: string;
    upgradeType: string;
}

export interface IPackageListItem {
    name: string;
    projects: IPackageProject[];
    resolvedChangelogCount: number;
    totalChangelogCount: number;
    lastPublishedAt: number | null;
    dependencyKind: string;
    registryResolved: boolean;
}

export interface IPackageListResponse {
    items: IPackageListItem[];
    total: number;
}

export interface IPackageListFilters {
    search?: string;
    upgradeType?: string;
    dependencyKind?: string;
    projectId?: string;
    hasChangelog?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
    teamId?: string;
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

export interface IPackagesGateway {
    list(filters?: IPackageListFilters): Promise<IPackageListResponse>;
    rescanPackage(packageName: string): Promise<void>;
    getPackageDetail(packageName: string): Promise<IPackageDetail>;
}

export const PackagesGateway = createAbstraction<IPackagesGateway>("Ui/PackagesGateway");

export namespace PackagesGateway {
    export type Interface = IPackagesGateway;
    export type PackageListItem = IPackageListItem;
    export type PackageProject = IPackageProject;
    export type ChangelogEntry = IChangelogEntry;
    export type Filters = IPackageListFilters;
    export type ListResponse = IPackageListResponse;
    export type PackageDetail = IPackageDetail;
    export type PackageDetailProject = IPackageDetailProject;
}
