import { TrendsRepository as Abstraction } from "./abstractions/TrendsRepository.js";
import type { DashboardGateway } from "../dashboard/abstractions/DashboardGateway.js";
import type { TrendsGateway } from "./abstractions/TrendsGateway.js";

class TrendsRepositoryImpl implements Abstraction.Interface {
    private stalenessTrend: DashboardGateway.StalenessTrendPoint[] = [];
    private licenseTrend: DashboardGateway.LicenseTrendPoint[] = [];
    private autoFixTrend: DashboardGateway.AutoFixTrendPoint[] = [];
    private dependencyChanges: TrendsGateway.DependencyChangeItem[] = [];
    private dependencyChangesTotal = 0;

    public getStalenessTrend(): DashboardGateway.StalenessTrendPoint[] {
        return this.stalenessTrend;
    }

    public setStalenessTrend(points: DashboardGateway.StalenessTrendPoint[]): void {
        this.stalenessTrend = points;
    }

    public getLicenseTrend(): DashboardGateway.LicenseTrendPoint[] {
        return this.licenseTrend;
    }

    public setLicenseTrend(points: DashboardGateway.LicenseTrendPoint[]): void {
        this.licenseTrend = points;
    }

    public getAutoFixTrend(): DashboardGateway.AutoFixTrendPoint[] {
        return this.autoFixTrend;
    }

    public setAutoFixTrend(points: DashboardGateway.AutoFixTrendPoint[]): void {
        this.autoFixTrend = points;
    }

    public getDependencyChanges(): TrendsGateway.DependencyChangeItem[] {
        return this.dependencyChanges;
    }

    public setDependencyChanges(items: TrendsGateway.DependencyChangeItem[], total: number): void {
        this.dependencyChanges = items;
        this.dependencyChangesTotal = total;
    }

    public getDependencyChangesTotal(): number {
        return this.dependencyChangesTotal;
    }
}

export const TrendsRepository = Abstraction.createImplementation({
    implementation: TrendsRepositoryImpl,
    dependencies: []
});
