import { PackagesGateway as Abstraction } from "./abstractions/PackagesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    listPackagesRoute,
    rescanPackageRoute,
    getPackageDetailRoute
} from "#shared/routes/index.js";

class PackagesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(filters?: Abstraction.Filters): Promise<Abstraction.ListResponse> {
        const query: Record<string, string> = {};
        if (filters?.search) {
            query["search"] = filters.search;
        }
        if (filters?.upgradeType) {
            query["upgradeType"] = filters.upgradeType;
        }
        if (filters?.dependencyKind) {
            query["dependencyKind"] = filters.dependencyKind;
        }
        if (filters?.projectId) {
            query["projectId"] = filters.projectId;
        }
        if (filters?.hasChangelog) {
            query["hasChangelog"] = "true";
        }
        if (filters?.page !== undefined) {
            query["page"] = String(filters.page);
        }
        if (filters?.pageSize !== undefined) {
            query["pageSize"] = String(filters.pageSize);
        }
        if (filters?.sortBy) {
            query["sortBy"] = filters.sortBy;
        }
        if (filters?.sortOrder) {
            query["sortOrder"] = filters.sortOrder;
        }
        if (filters?.teamId) {
            query["teamId"] = filters.teamId;
        }

        const response = await this.httpClient.request(listPackagesRoute, {
            params: {},
            query: Object.keys(query).length > 0 ? query : undefined
        });
        return { items: response.items, total: response.total };
    }

    public async rescanPackage(packageName: string): Promise<void> {
        await this.httpClient.request(rescanPackageRoute, {
            params: { packageName },
            query: {}
        });
    }

    public async getPackageDetail(packageName: string): Promise<Abstraction.PackageDetail> {
        const response = await this.httpClient.request(getPackageDetailRoute, {
            params: { packageName }
        });
        return response.item;
    }
}

export const PackagesGateway = Abstraction.createImplementation({
    implementation: PackagesGatewayImpl,
    dependencies: [HTTPClient]
});
