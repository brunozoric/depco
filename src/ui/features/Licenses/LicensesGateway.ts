import { LicensesGateway as Abstraction } from "./abstractions/LicensesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
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
import { cleanQuery, cleanQueryRecord } from "../../infrastructure/HttpClient/cleanQuery.js";

function buildLicenseListQuery(
    filters?: Abstraction.ListFilters
): Record<string, string> | undefined {
    return cleanQueryRecord({
        projectId: filters?.projectId,
        riskTier: filters?.riskTier,
        packageName: filters?.packageName,
        spdxId: filters?.spdxId,
        teamId: filters?.teamId,
        violationAction: filters?.violationAction,
        page: filters?.page ? String(filters.page) : undefined,
        pageSize: filters?.pageSize ? String(filters.pageSize) : undefined,
        sortBy: filters?.sortBy,
        sortOrder: filters?.sortOrder
    });
}

class LicensesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(filters?: Abstraction.ListFilters): Promise<Abstraction.ListResponse> {
        return this.httpClient.request(listLicensesRoute, {
            params: {},
            query: buildLicenseListQuery(filters)
        });
    }

    public async getByProject(
        projectId: string,
        filters?: Abstraction.ListFilters
    ): Promise<Abstraction.ListResponse> {
        return this.httpClient.request(getProjectLicensesRoute, {
            params: { projectId },
            query: buildLicenseListQuery(filters)
        });
    }

    public async getSummary(teamId?: string, projectId?: string): Promise<Abstraction.SummaryData> {
        return this.httpClient.request(getLicenseSummaryRoute, {
            params: {},
            query: cleanQuery({ teamId, projectId })
        });
    }

    public async scan(projectId: string): Promise<Abstraction.ScanResult> {
        return this.httpClient.request(scanProjectLicensesRoute, { params: { projectId } });
    }

    public async listPolicies(
        filters?: Abstraction.PolicyListFilters
    ): Promise<Abstraction.PolicyListResponse> {
        return this.httpClient.request(listLicensePoliciesRoute, {
            params: {},
            query: cleanQuery({ projectId: filters?.projectId })
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
        return this.httpClient.request(listLicenseViolationsRoute, {
            params: {},
            query: cleanQuery({
                projectId: filters?.projectId,
                action: filters?.action,
                packageName: filters?.packageName,
                teamId: filters?.teamId
            })
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
