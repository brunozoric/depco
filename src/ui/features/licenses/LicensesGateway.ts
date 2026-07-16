import { LicensesGateway as Abstraction } from "./abstractions/LicensesGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import {
    listLicensesRoute,
    getProjectLicensesRoute,
    getLicenseSummaryRoute,
    scanProjectLicensesRoute,
    listLicensePoliciesRoute,
    createLicensePolicyRoute,
    updateLicensePolicyRoute,
    deleteLicensePolicyRoute,
    listLicenseViolationsRoute,
    getLicenseViolationsSummaryRoute
} from "#shared/routes/index.js";

function buildLicenseListQuery(filters?: Abstraction.ListFilters): Record<string, string> {
    const query: Record<string, string> = {};
    if (filters?.projectId) {
        query["projectId"] = filters.projectId;
    }
    if (filters?.riskTier) {
        query["riskTier"] = filters.riskTier;
    }
    if (filters?.packageName) {
        query["packageName"] = filters.packageName;
    }
    if (filters?.spdxId) {
        query["spdxId"] = filters.spdxId;
    }
    if (filters?.teamId) {
        query["teamId"] = filters.teamId;
    }
    if (filters?.violationAction) {
        query["violationAction"] = filters.violationAction;
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

function buildPolicyListQuery(filters?: Abstraction.PolicyListFilters): Record<string, string> {
    const query: Record<string, string> = {};
    if (filters?.projectId) {
        query["projectId"] = filters.projectId;
    }
    return query;
}

function buildViolationListQuery(
    filters?: Abstraction.ViolationListFilters
): Record<string, string> {
    const query: Record<string, string> = {};
    if (filters?.projectId) {
        query["projectId"] = filters.projectId;
    }
    if (filters?.action) {
        query["action"] = filters.action;
    }
    if (filters?.packageName) {
        query["packageName"] = filters.packageName;
    }
    if (filters?.teamId) {
        query["teamId"] = filters.teamId;
    }
    return query;
}

class LicensesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(filters?: Abstraction.ListFilters): Promise<Abstraction.ListResponse> {
        const query = buildLicenseListQuery(filters);

        return this.httpClient.request(listLicensesRoute, {
            params: {},
            query: Object.keys(query).length > 0 ? query : undefined
        });
    }

    public async getByProject(
        projectId: string,
        filters?: Abstraction.ListFilters
    ): Promise<Abstraction.ListResponse> {
        const query = buildLicenseListQuery(filters);

        return this.httpClient.request(getProjectLicensesRoute, {
            params: { projectId },
            query: Object.keys(query).length > 0 ? query : undefined
        });
    }

    public async getSummary(teamId?: string, projectId?: string): Promise<Abstraction.SummaryData> {
        const query: Record<string, string> = {};
        if (teamId) {
            query["teamId"] = teamId;
        }
        if (projectId) {
            query["projectId"] = projectId;
        }
        return this.httpClient.request(getLicenseSummaryRoute, {
            params: {},
            query: Object.keys(query).length > 0 ? query : {}
        });
    }

    public async scan(projectId: string): Promise<Abstraction.ScanResult> {
        return this.httpClient.request(scanProjectLicensesRoute, { params: { projectId } });
    }

    public async listPolicies(
        filters?: Abstraction.PolicyListFilters
    ): Promise<Abstraction.PolicyListResponse> {
        const query = buildPolicyListQuery(filters);

        return this.httpClient.request(listLicensePoliciesRoute, {
            params: {},
            query: Object.keys(query).length > 0 ? query : undefined
        });
    }

    public async createPolicy(
        input: Abstraction.CreatePolicyInput
    ): Promise<Abstraction.PolicyRule> {
        return this.httpClient.request(createLicensePolicyRoute, {
            params: {},
            body: input
        });
    }

    public async updatePolicy(
        id: string,
        input: Abstraction.UpdatePolicyInput
    ): Promise<Abstraction.PolicyRule> {
        return this.httpClient.request(updateLicensePolicyRoute, {
            params: { id },
            body: input
        });
    }

    public async deletePolicy(id: string): Promise<Abstraction.DeletePolicyResult> {
        return this.httpClient.request(deleteLicensePolicyRoute, { params: { id } });
    }

    public async listViolations(
        filters?: Abstraction.ViolationListFilters
    ): Promise<Abstraction.ViolationListResponse> {
        const query = buildViolationListQuery(filters);

        return this.httpClient.request(listLicenseViolationsRoute, {
            params: {},
            query: Object.keys(query).length > 0 ? query : undefined
        });
    }

    public async getViolationsSummary(teamId?: string): Promise<Abstraction.ViolationsSummaryData> {
        return this.httpClient.request(getLicenseViolationsSummaryRoute, {
            params: {},
            query: teamId ? { teamId } : {}
        });
    }
}

export const LicensesGateway = Abstraction.createImplementation({
    implementation: LicensesGatewayImpl,
    dependencies: [HTTPClient]
});
