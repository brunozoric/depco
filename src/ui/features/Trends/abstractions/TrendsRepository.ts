import { createAbstraction } from "#shared/index.js";
import type { DashboardGateway } from "../../Dashboard/abstractions/DashboardGateway.js";
import type { TrendsGateway } from "./TrendsGateway.js";

export interface ITrendsRepository {
    getStalenessTrend(): DashboardGateway.StalenessTrendPoint[];
    setStalenessTrend(points: DashboardGateway.StalenessTrendPoint[]): void;
    getLicenseTrend(): DashboardGateway.LicenseTrendPoint[];
    setLicenseTrend(points: DashboardGateway.LicenseTrendPoint[]): void;
    getAutoFixTrend(): DashboardGateway.AutoFixTrendPoint[];
    setAutoFixTrend(points: DashboardGateway.AutoFixTrendPoint[]): void;
    getDependencyChanges(): TrendsGateway.DependencyChangeItem[];
    setDependencyChanges(items: TrendsGateway.DependencyChangeItem[], total: number): void;
    getDependencyChangesTotal(): number;
}

export const TrendsRepository = createAbstraction<ITrendsRepository>("Ui/TrendsRepository");

export namespace TrendsRepository {
    export type Interface = ITrendsRepository;
}
