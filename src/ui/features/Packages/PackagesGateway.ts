import { PackagesGateway as Abstraction } from "./abstractions/PackagesGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import {
    listPackagesRoute,
    rescanPackageRoute,
    getChangelogsRoute,
    reResolveChangelogsRoute
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

    public async getChangelogs(
        packageName: string,
        from: string,
        to: string
    ): Promise<Abstraction.ChangelogResult> {
        const response = await this.httpClient.request(getChangelogsRoute, {
            params: { packageName },
            query: { from, to }
        });
        return { entries: response.items, resolving: response.resolving };
    }

    public async reResolveChangelogs(
        packageName: string,
        from: string,
        to: string
    ): Promise<Abstraction.ChangelogResult> {
        const response = await this.httpClient.request(reResolveChangelogsRoute, {
            params: { packageName },
            body: { from, to }
        });
        return { entries: response.items, resolving: response.resolving };
    }
}

export const PackagesGateway = Abstraction.createImplementation({
    implementation: PackagesGatewayImpl,
    dependencies: [HTTPClient]
});
