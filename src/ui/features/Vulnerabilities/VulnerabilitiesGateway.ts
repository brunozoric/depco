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

function buildListQuery(filters?: Abstraction.ListFilters): Record<string, string> {
    const query: Record<string, string> = {};
    if (filters?.severity) {
        query["severity"] = filters.severity;
    }
    if (filters?.packageName) {
        query["packageName"] = filters.packageName;
    }
    if (filters?.source) {
        query["source"] = filters.source;
    }
    if (filters?.projectIds?.length) {
        query["projectIds"] = filters.projectIds.join(",");
    }
    if (filters?.includeDismissed) {
        query["includeDismissed"] = "true";
    }
    if (filters?.scannedDate) {
        query["scannedDate"] = filters.scannedDate;
    }
    if (filters?.teamId) {
        query["teamId"] = filters.teamId;
    }
    if (filters?.dependencyType && filters.dependencyType !== "all") {
        query["dependencyType"] = filters.dependencyType;
    }
    if (filters?.page) {
        query["page"] = String(filters.page);
    }
    if (filters?.pageSize) {
        query["pageSize"] = String(filters.pageSize);
    }
    if (filters?.sortBy) {
        query["sortBy"] = filters.sortBy;
    }
    if (filters?.sortOrder) {
        query["sortOrder"] = filters.sortOrder;
    }
    return query;
}

class VulnerabilitiesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(filters?: Abstraction.ListFilters): Promise<Abstraction.ListResponse> {
        const query = buildListQuery(filters);

        return this.httpClient.request(listVulnerabilitiesRoute, {
            params: {},
            query: Object.keys(query).length > 0 ? query : undefined
        });
    }

    public async getByProject(
        projectId: string,
        filters?: Abstraction.ListFilters
    ): Promise<Abstraction.ListResponse> {
        const query = buildListQuery(filters);

        return this.httpClient.request(getProjectVulnerabilitiesRoute, {
            params: { projectId },
            query: Object.keys(query).length > 0 ? query : undefined
        });
    }

    public async getSummary(teamId?: string): Promise<Abstraction.SummaryData> {
        return this.httpClient.request(getVulnerabilitySummaryRoute, {
            params: {},
            query: teamId ? { teamId } : {}
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
