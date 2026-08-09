import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "../../../../features/Dashboard/abstractions/DashboardGateway.js";
import type { TrendsGateway } from "../../../../features/Trends/abstractions/TrendsGateway.js";

export interface IProjectOption {
    id: string;
    name: string;
}

export interface IPackageCountPoint {
    date: string;
    totalPackages: number;
}

export interface ITrendsViewModel {
    loading: boolean;
    error: string | null;
    stalenessPoints: DashboardGateway.StalenessTrendPoint[];
    stalenessRange: string;
    licensePoints: DashboardGateway.LicenseTrendPoint[];
    licenseRange: string;
    autoFixPoints: DashboardGateway.AutoFixTrendPoint[];
    autoFixRange: string;
    packageCountPoints: IPackageCountPoint[];
    dependencyChanges: TrendsGateway.DependencyChangeItem[];
    dependencyChangesTotal: number;
    dependencyChangesProjectFilter: string | null;
    availableProjects: IProjectOption[];
}

export interface ITrendsPresenter {
    get vm(): ITrendsViewModel;
    load(): Promise<void>;
    setStalenessRange(range: string): void;
    setLicenseRange(range: string): void;
    setAutoFixRange(range: string): void;
    setDependencyChangesProjectFilter(projectId: string | null): void;
    dispose(): void;
}

export const TrendsPresenter = createAbstraction<ITrendsPresenter>("Ui/TrendsPresenter");

export namespace TrendsPresenter {
    export type Interface = ITrendsPresenter;
    export type ViewModel = ITrendsViewModel;
    export type ProjectOption = IProjectOption;
    export type PackageCountPoint = IPackageCountPoint;
}
