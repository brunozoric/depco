import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "../../dashboard/abstractions/DashboardGateway.js";

export interface IDependencyChangesFilters {
    projectId?: string;
    limit?: number;
    teamId?: string;
}

export interface IDependencyChangeItem {
    id: string;
    projectId: string;
    projectName: string;
    packageName: string;
    changeType: "added" | "removed" | "version-changed";
    previousVersion: string | null;
    newVersion: string | null;
    detectedAt: number;
}

export interface IDependencyChangesResponse {
    items: IDependencyChangeItem[];
    total: number;
}

export interface ITrendsGateway {
    getStalenessTrend(
        days?: string,
        teamId?: string
    ): Promise<DashboardGateway.StalenessTrendResponse>;
    getLicenseTrend(days?: string, teamId?: string): Promise<DashboardGateway.LicenseTrendResponse>;
    getAutoFixTrend(days?: string, teamId?: string): Promise<DashboardGateway.AutoFixTrendResponse>;
    getDependencyChanges(filters?: IDependencyChangesFilters): Promise<IDependencyChangesResponse>;
}

export const TrendsGateway = createAbstraction<ITrendsGateway>("Ui/TrendsGateway");

export namespace TrendsGateway {
    export type Interface = ITrendsGateway;
    export type DependencyChangesFilters = IDependencyChangesFilters;
    export type DependencyChangeItem = IDependencyChangeItem;
    export type DependencyChangesResponse = IDependencyChangesResponse;
}
