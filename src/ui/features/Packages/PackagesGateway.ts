import { PackagesGateway as Abstraction } from "./abstractions/PackagesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import {
    listPackagesRoute,
    rescanPackageRoute,
    getPackageDetailRoute
} from "#shared/routes/index.js";
import { cleanQueryRecord } from "../../infrastructure/HttpClient/cleanQuery.js";

class PackagesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(filters?: Abstraction.Filters): Promise<Abstraction.ListResponse> {
        const query = cleanQueryRecord({
            search: filters?.search,
            upgradeType: filters?.upgradeType,
            dependencyKind: filters?.dependencyKind,
            projectId: filters?.projectId,
            hasChangelog: filters?.hasChangelog ? "true" : undefined,
            page: filters?.page !== undefined ? String(filters.page) : undefined,
            pageSize: filters?.pageSize !== undefined ? String(filters.pageSize) : undefined,
            sortBy: filters?.sortBy,
            sortOrder: filters?.sortOrder,
            teamId: filters?.teamId
        });

        const response = await this.httpClient.request(listPackagesRoute, {
            params: {},
            query
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
