import { VulnerabilitiesGateway as Abstraction } from "./abstractions/VulnerabilitiesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    listVulnerabilitiesRoute,
    getProjectVulnerabilitiesRoute,
    getVulnerabilitySummaryRoute,
    scanVulnerabilitiesRoute,
    refreshOsvCacheRoute,
    bulkVulnerabilitiesRoute,
    bulkRescanVulnerabilitiesRoute,
    getVulnerabilityDetailRoute,
    getExpiredSnoozesRoute
} from "#shared/routes/index.js";
import { cleanQuery, cleanQueryRecord } from "../../infrastructure/HttpClient/cleanQuery.js";

function buildListQuery(filters?: Abstraction.ListFilters): Record<string, string> | undefined {
    return cleanQueryRecord({
        severity: filters?.severity,
        packageName: filters?.packageName,
        source: filters?.source,
        projectIds: filters?.projectIds?.length ? filters.projectIds.join(",") : undefined,
        includeDismissed: filters?.includeDismissed ? "true" : undefined,
        scannedDate: filters?.scannedDate,
        teamId: filters?.teamId,
        dependencyType:
            filters?.dependencyType && filters.dependencyType !== "all"
                ? filters.dependencyType
                : undefined,
        page: filters?.page ? String(filters.page) : undefined,
        pageSize: filters?.pageSize ? String(filters.pageSize) : undefined,
        sortBy: filters?.sortBy,
        sortOrder: filters?.sortOrder
    });
}

class VulnerabilitiesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(filters?: Abstraction.ListFilters): Promise<Abstraction.ListResponse> {
        return this.httpClient.request(listVulnerabilitiesRoute, {
            params: {},
            query: buildListQuery(filters)
        });
    }

    public async getByProject(
        projectId: string,
        filters?: Abstraction.ListFilters
    ): Promise<Abstraction.ListResponse> {
        return this.httpClient.request(getProjectVulnerabilitiesRoute, {
            params: { projectId },
            query: buildListQuery(filters)
        });
    }

    public async getSummary(teamId?: string): Promise<Abstraction.SummaryData> {
        return this.httpClient.request(getVulnerabilitySummaryRoute, {
            params: {},
            query: cleanQuery({ teamId })
        });
    }

    public async scan(projectId: string): Promise<Abstraction.ScanResult> {
        return this.httpClient.request(scanVulnerabilitiesRoute, {
            params: { projectId }
        });
    }

    public async refreshOsvCache(
        options: Abstraction.RefreshOptions
    ): Promise<Abstraction.RefreshResult> {
        return this.httpClient.request(refreshOsvCacheRoute, {
            params: {},
            body: options
        });
    }

    public async bulkAction({
        ids,
        action,
        snoozeDays
    }: Abstraction.BulkActionParams): Promise<Abstraction.BulkResult> {
        if (action === "snooze") {
            return this.httpClient.request(bulkVulnerabilitiesRoute, {
                params: {},
                body: { ids, action, snoozeDays: snoozeDays as 7 | 30 | 90 }
            });
        }
        return this.httpClient.request(bulkVulnerabilitiesRoute, {
            params: {},
            body: { ids, action }
        });
    }

    public async bulkRescan(ids: string[]): Promise<Abstraction.RescanResult> {
        return this.httpClient.request(bulkRescanVulnerabilitiesRoute, {
            params: {},
            body: { ids }
        });
    }

    public getExportUrl({ filters, format, ids, teamId }: Abstraction.ExportParams): string {
        const params = new URLSearchParams({ format });
        if (filters.severity) {
            params.set("severity", filters.severity);
        }
        if (filters.packageName) {
            params.set("packageName", filters.packageName);
        }
        if (filters.source) {
            params.set("source", filters.source);
        }
        if (filters.projectIds?.length) {
            params.set("projectIds", filters.projectIds.join(","));
        }
        if (filters.includeDismissed) {
            params.set("includeDismissed", "true");
        }
        if (ids?.length) {
            params.set("ids", ids.join(","));
        }
        if (teamId) {
            params.set("teamId", teamId);
        }
        if (filters.dependencyType && filters.dependencyType !== "all") {
            params.set("dependencyType", filters.dependencyType);
        }
        return `/api/vulnerabilities/export?${params.toString()}`;
    }

    public async getDetail(vulnerabilityId: string): Promise<Abstraction.DetailData> {
        return this.httpClient.request(getVulnerabilityDetailRoute, {
            params: { vulnerabilityId }
        });
    }

    public async getExpiredSnoozes(sinceMs: number): Promise<Abstraction.ExpiredSnoozesData> {
        return this.httpClient.request(getExpiredSnoozesRoute, {
            params: {},
            query: { since: sinceMs }
        });
    }
}

export const VulnerabilitiesGateway = Abstraction.createImplementation({
    implementation: VulnerabilitiesGatewayImpl,
    dependencies: [HTTPClient]
});
