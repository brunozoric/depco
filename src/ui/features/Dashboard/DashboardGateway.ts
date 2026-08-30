import { DashboardGateway as Abstraction } from "./abstractions/DashboardGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    dashboardHealthRoute,
    dashboardTrendRoute,
    dashboardActivityRoute,
    dashboardStalenessRoute,
    dashboardSecurityRoute,
    getVulnerabilitySummaryRoute,
    dashboardVulnerabilityTrendRoute,
    getLicenseSummaryRoute,
    listAutoFixPullRequestsRoute,
    dashboardStalenessTrendRoute,
    dashboardLicenseTrendRoute,
    dashboardAutoFixTrendRoute,
    dashboardScoreDetailRoute
} from "#shared/routes/index.js";
import { cleanQuery } from "../../infrastructure/HttpClient/cleanQuery.js";

type TrendRangeQuery = "7d" | "30d" | "90d" | "all" | undefined;
type VulnerabilityTrendDaysQuery = "7" | "30" | "90";
export type SparklineTrendDaysQuery = "7" | "30" | "90" | undefined;

class DashboardGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async getHealth(teamId?: string): Promise<Abstraction.HealthResponse> {
        return this.httpClient.request(dashboardHealthRoute, {
            params: {},
            query: cleanQuery({ teamId })
        });
    }

    public async getTrend({
        range,
        teamId
    }: Abstraction.TrendParams): Promise<Abstraction.TrendResponse> {
        return this.httpClient.request(dashboardTrendRoute, {
            params: {},
            query: cleanQuery({ range: range as TrendRangeQuery, teamId })
        });
    }

    public async getActivity(teamId?: string): Promise<Abstraction.ActivityResponse> {
        return this.httpClient.request(dashboardActivityRoute, {
            params: {},
            query: cleanQuery({ teamId })
        });
    }

    public async getStaleness(teamId?: string): Promise<Abstraction.StalenessResponse> {
        return this.httpClient.request(dashboardStalenessRoute, {
            params: {},
            query: cleanQuery({ teamId })
        });
    }

    public async getSecurity(teamId?: string): Promise<Abstraction.SecurityResponse> {
        return this.httpClient.request(dashboardSecurityRoute, {
            params: {},
            query: cleanQuery({ teamId })
        });
    }

    public async getVulnerabilitySummary(
        teamId?: string
    ): Promise<Abstraction.VulnerabilitySummaryResponse> {
        return this.httpClient.request(getVulnerabilitySummaryRoute, {
            params: {},
            query: cleanQuery({ teamId })
        });
    }

    public async getVulnerabilityTrend(
        params?: Abstraction.VulnerabilityTrendParams
    ): Promise<Abstraction.VulnerabilityTrendResponse> {
        return this.httpClient.request(dashboardVulnerabilityTrendRoute, {
            params: {},
            query: cleanQuery({
                days: params?.days
                    ? (String(params.days) as VulnerabilityTrendDaysQuery)
                    : undefined,
                teamId: params?.teamId
            })
        });
    }

    public async getLicenseSummary(teamId?: string): Promise<Abstraction.LicenseComplianceSummary> {
        return this.httpClient.request(getLicenseSummaryRoute, {
            params: {},
            query: cleanQuery({ teamId })
        });
    }

    public async getOpenAutoFixPrCount(teamId?: string): Promise<number> {
        const response = await this.httpClient.request(listAutoFixPullRequestsRoute, {
            params: {},
            query: cleanQuery({ status: "created" as const, teamId })
        });
        return response.total;
    }

    public async getStalenessTrend(
        params?: Abstraction.SparklineTrendParams
    ): Promise<Abstraction.StalenessTrendResponse> {
        return this.httpClient.request(dashboardStalenessTrendRoute, {
            params: {},
            query: cleanQuery({
                days: params?.days as SparklineTrendDaysQuery,
                teamId: params?.teamId
            })
        });
    }

    public async getLicenseTrend(
        params?: Abstraction.SparklineTrendParams
    ): Promise<Abstraction.LicenseTrendResponse> {
        return this.httpClient.request(dashboardLicenseTrendRoute, {
            params: {},
            query: cleanQuery({
                days: params?.days as SparklineTrendDaysQuery,
                teamId: params?.teamId
            })
        });
    }

    public async getAutoFixTrend(
        params?: Abstraction.SparklineTrendParams
    ): Promise<Abstraction.AutoFixTrendResponse> {
        return this.httpClient.request(dashboardAutoFixTrendRoute, {
            params: {},
            query: cleanQuery({
                days: params?.days as SparklineTrendDaysQuery,
                teamId: params?.teamId
            })
        });
    }

    public async getScoreDetail(projectId: string): Promise<Abstraction.ScoreDetailResponse> {
        return this.httpClient.request(dashboardScoreDetailRoute, {
            params: { projectId },
            query: {}
        });
    }
}

export const DashboardGateway = Abstraction.createImplementation({
    implementation: DashboardGatewayImpl,
    dependencies: [HTTPClient]
});
