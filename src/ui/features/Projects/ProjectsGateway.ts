import {
    createProjectRoute,
    listProjectsRoute,
    getProjectRoute,
    deleteProjectRoute,
    scanProjectAsyncRoute,
    getProjectDependenciesRoute,
    getProjectSecurityRoute,
    checkProjectSecurityRoute,
    cloneProjectRoute,
    installProjectRoute,
    getInstallOptionsRoute,
    bulkScanProjectsRoute
} from "#shared/routes/index.js";
import type { IDependency, IProject } from "./abstractions/ProjectsGateway.js";
import { ProjectsGateway as Abstraction } from "./abstractions/ProjectsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";

function toProject(item: {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    security?: Abstraction.SecurityStatus | null | undefined;
    hasNodeModules?: boolean;
    teams?: Array<{ id: string; name: string; color: string }> | undefined;
}): IProject {
    return {
        id: item.id,
        name: item.name,
        path: item.path,
        packageManager: item.packageManager,
        pmVersion: item.pmVersion,
        addedAt: item.addedAt,
        lastScannedAt: item.lastScannedAt,
        security: item.security ?? null,
        hasNodeModules: item.hasNodeModules ?? false,
        teams: item.teams ?? []
    };
}

function toInstallFlagDefinition(item: {
    flag: string;
    label: string;
    description: string;
    exclusive?: string | undefined;
    defaultEnabled: boolean;
}): Abstraction.InstallFlagDefinition {
    return {
        flag: item.flag,
        label: item.label,
        description: item.description,
        defaultEnabled: item.defaultEnabled,
        ...(item.exclusive !== undefined ? { exclusive: item.exclusive } : {})
    };
}

function toDependency(item: {
    name: string;
    currentVersion: string;
    latestInRange: string | null;
    latestVersion: string | null;
    type: string;
    upgradeType: string | null;
    dependencyKind?: string | undefined;
    registryResolved?: boolean | undefined;
}): IDependency {
    return {
        name: item.name,
        currentVersion: item.currentVersion,
        latestInRange: item.latestInRange ?? item.currentVersion,
        latestVersion: item.latestVersion ?? item.currentVersion,
        type: item.type as IDependency["type"],
        upgradeType: (item.upgradeType ?? "none") as IDependency["upgradeType"],
        dependencyKind: item.dependencyKind ?? "dependency",
        registryResolved: item.registryResolved ?? true
    };
}

class ProjectsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async list(params?: Abstraction.ListParams): Promise<Abstraction.ListResponse> {
        const response = await this.httpClient.request(listProjectsRoute, {
            params: {},
            query: {
                page: params?.page,
                pageSize: params?.pageSize,
                search: params?.search,
                teamId: params?.teamId
            }
        });
        return { items: response.items.map(toProject), total: response.total };
    }

    public async get(id: string): Promise<Abstraction.Project> {
        const response = await this.httpClient.request(getProjectRoute, { params: { id } });
        return toProject(response.item);
    }

    public async create(path: string): Promise<Abstraction.Project> {
        const response = await this.httpClient.request(createProjectRoute, {
            params: {},
            body: { path }
        });
        return toProject(response.item);
    }

    public async remove(id: string): Promise<void> {
        await this.httpClient.request(deleteProjectRoute, { params: { id } });
    }

    public async scan(id: string, force?: boolean): Promise<Abstraction.ScanJob> {
        const response = await this.httpClient.request(scanProjectAsyncRoute, {
            params: { id },
            query: force ? { force: "true" } : undefined
        });
        return response.item;
    }

    public async getDependencies(
        id: string,
        filters?: Abstraction.DependencyFilters
    ): Promise<Abstraction.DependenciesResponse> {
        const response = await this.httpClient.request(getProjectDependenciesRoute, {
            params: { id },
            query: {
                page: filters?.page,
                pageSize: filters?.pageSize,
                search: filters?.search,
                dependencyKind: filters?.dependencyKind as
                    | "all"
                    | "dependency"
                    | "devDependency"
                    | "peerDependency"
                    | "optionalDependency"
                    | "transitive"
                    | undefined,
                registryResolved: filters?.registryResolved as "all" | "true" | "false" | undefined
            }
        });
        return {
            dependencies: response.items.map(toDependency),
            total: response.total,
            lastScannedAt: null
        };
    }

    public async getSecurity(id: string): Promise<Abstraction.SecurityStatus> {
        const response = await this.httpClient.request(getProjectSecurityRoute, { params: { id } });
        return response.item;
    }

    public async checkSecurity(id: string): Promise<Abstraction.SecurityStatus> {
        const response = await this.httpClient.request(checkProjectSecurityRoute, {
            params: { id }
        });
        return response.item;
    }

    public async clone(
        url: string,
        destination: string,
        folderName?: string
    ): Promise<Abstraction.ScanJob> {
        const body: { url: string; destination: string; folderName?: string } = {
            url,
            destination
        };
        if (folderName) {
            body.folderName = folderName;
        }
        const response = await this.httpClient.request(cloneProjectRoute, {
            params: {},
            body
        });
        return response.item;
    }

    public async install(id: string, flags: string[] = []): Promise<Abstraction.ScanJob> {
        const response = await this.httpClient.request(installProjectRoute, {
            params: { id },
            body: { flags }
        });
        return response.item;
    }

    public async getInstallOptions(
        packageManager: string
    ): Promise<Abstraction.InstallFlagDefinition[]> {
        const response = await this.httpClient.request(getInstallOptionsRoute, {
            params: { packageManager }
        });
        return response.items.map(toInstallFlagDefinition);
    }

    public async bulkScan(
        projectIds: string[],
        force?: boolean
    ): Promise<Abstraction.BulkScanResult> {
        return this.httpClient.request(bulkScanProjectsRoute, {
            params: {},
            body: { projectIds, force }
        });
    }
}

export const ProjectsGateway = Abstraction.createImplementation({
    implementation: ProjectsGatewayImpl,
    dependencies: [HTTPClient]
});
