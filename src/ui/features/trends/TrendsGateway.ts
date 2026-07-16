import { TrendsGateway as Abstraction } from "./abstractions/TrendsGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import type { DashboardGateway } from "../dashboard/abstractions/DashboardGateway.js";
import {
    dashboardStalenessTrendRoute,
    dashboardLicenseTrendRoute,
    dashboardAutoFixTrendRoute,
    dashboardDependencyChangesRoute
} from "#shared/routes/index.js";
import { cleanQuery } from "../../httpClient/cleanQuery.js";

type SparklineTrendDaysQuery = "7" | "30" | "90" | undefined;

class TrendsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async getStalenessTrend(
        days?: string,
        teamId?: string
    ): Promise<DashboardGateway.StalenessTrendResponse> {
        return this.httpClient.request(dashboardStalenessTrendRoute, {
            params: {},
            query: cleanQuery({ days: days as SparklineTrendDaysQuery, teamId })
        });
    }

    public async getLicenseTrend(
        days?: string,
        teamId?: string
    ): Promise<DashboardGateway.LicenseTrendResponse> {
        return this.httpClient.request(dashboardLicenseTrendRoute, {
            params: {},
            query: cleanQuery({ days: days as SparklineTrendDaysQuery, teamId })
        });
    }

    public async getAutoFixTrend(
        days?: string,
        teamId?: string
    ): Promise<DashboardGateway.AutoFixTrendResponse> {
        return this.httpClient.request(dashboardAutoFixTrendRoute, {
            params: {},
            query: cleanQuery({ days: days as SparklineTrendDaysQuery, teamId })
        });
    }

    public async getDependencyChanges(
        filters?: Abstraction.DependencyChangesFilters
    ): Promise<Abstraction.DependencyChangesResponse> {
        return this.httpClient.request(dashboardDependencyChangesRoute, {
            params: {},
            query: cleanQuery({
                projectId: filters?.projectId,
                limit: filters?.limit ?? 50,
                teamId: filters?.teamId
            })
        });
    }
}

export const TrendsGateway = Abstraction.createImplementation({
    implementation: TrendsGatewayImpl,
    dependencies: [HTTPClient]
});
