import { createAbstraction } from "#shared/index.js";
import type { PackagesGateway } from "../../../../features/packages/abstractions/PackagesGateway.js";
import type {
    IChangelogTrackingState,
    IStartChangelogTrackingInput
} from "../../../shared/ChangelogTracker.js";

export interface IPackageListItemViewModel {
    name: string;
    projects: PackagesGateway.PackageProject[];
    changelogCount: number;
    highestUpgradeType: string;
    minCurrentVersion: string;
    maxLatestVersion: string;
    lastPublishedAt: number | null;
    registryResolved: boolean;
}

export interface IProjectFilterOption {
    value: string;
    label: string;
}

export interface IPackagesViewModel {
    loading: boolean;
    error: string | null;
    packages: IPackageListItemViewModel[];
    search: string;
    upgradeType: string | null;
    dependencyKind: string | null;
    projectId: string | null;
    hasChangelog: boolean;
    projectOptions: IProjectFilterOption[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    sortBy: string;
    sortOrder: string;
    expandedPackageName: string | null;
    changelogState: IChangelogTrackingState | null;
}

export interface IPackagesPresenter {
    get vm(): IPackagesViewModel;
    load: () => Promise<void>;
    setSearch: (value: string) => void;
    setUpgradeType: (value: string | null) => void;
    setDependencyKind: (value: string | null) => void;
    setProjectId: (value: string | null) => void;
    setHasChangelog: (value: boolean) => void;
    setPage: (page: number) => void;
    setSortBy: (sortBy: string) => void;
    togglePackageDetails: (name: string) => void;
    upgradePackage: (
        projectId: string,
        packageName: string,
        targetVersion: string
    ) => Promise<void>;
    rescanPackage: (packageName: string) => Promise<void>;
    getChangelogs: (
        packageName: string,
        from: string,
        to: string
    ) => Promise<PackagesGateway.ChangelogResult>;
    reResolveChangelogs: (
        packageName: string,
        from: string,
        to: string
    ) => Promise<PackagesGateway.ChangelogResult>;
    startChangelogTracking: (input: IStartChangelogTrackingInput) => void;
    stopChangelogTracking: () => void;
    dispose: () => void;
}

export const PackagesPresenter = createAbstraction<IPackagesPresenter>("Ui/PackagesPresenter");

export namespace PackagesPresenter {
    export type Interface = IPackagesPresenter;
    export type ViewModel = IPackagesViewModel;
    export type PackageListItem = IPackageListItemViewModel;
    export type ProjectFilterOption = IProjectFilterOption;
}
