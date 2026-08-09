import {
    createUpgradeJobRoute,
    createTransientJobRoute,
    listJobsRoute,
    getJobRoute,
    updatePackageManagerRoute,
    getPackageManagerRoute,
    clearCacheRoute,
    clearPackageCacheRoute
} from "#shared/routes/index.js";
import type { IJob } from "./abstractions/UpgradesGateway.js";
import { UpgradesGateway as Abstraction } from "./abstractions/UpgradesGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";

function toJob(item: {
    id: string;
    referenceId: string;
    referenceType: string;
    type: string;
    status: string;
    packages: string | null;
    logs: string | null;
    startedAt: number | null;
    completedAt: number | null;
    warning?: string | null | undefined;
    progress: number | null;
    progressLabel: string | null;
}): IJob {
    return {
        id: item.id,
        referenceId: item.referenceId,
        referenceType: item.referenceType,
        type: item.type as IJob["type"],
        status: item.status as IJob["status"],
        packages: item.packages,
        logs: item.logs,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        warning: item.warning ?? null,
        progress: item.progress,
        progressLabel: item.progressLabel
    };
}

class UpgradesGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async startUpgrade(
        projectId: string,
        packages: Abstraction.UpgradePackageInput[],
        refreshTransient: boolean
    ): Promise<Abstraction.JobHandle> {
        const response = await this.httpClient.request(createUpgradeJobRoute, {
            params: { id: projectId },
            body: { packages, refreshTransient }
        });
        return response.item;
    }

    public async startTransient(projectId: string): Promise<Abstraction.JobHandle> {
        const response = await this.httpClient.request(createTransientJobRoute, {
            params: { id: projectId }
        });
        return response.item;
    }

    public async getJob(projectId: string, jobId: string): Promise<Abstraction.Job> {
        const response = await this.httpClient.request(getJobRoute, {
            params: { id: projectId, jobId }
        });
        return toJob(response.item);
    }

    public async getJobs(projectId: string): Promise<Abstraction.Job[]> {
        const response = await this.httpClient.request(listJobsRoute, {
            params: { id: projectId }
        });
        return response.items.map(toJob);
    }

    public async updatePackageManager(
        projectId: string,
        version: string
    ): Promise<Abstraction.JobHandle> {
        const response = await this.httpClient.request(updatePackageManagerRoute, {
            params: { id: projectId },
            body: { version }
        });
        return response.item;
    }

    public async getPackageManagerInfo(projectId: string): Promise<Abstraction.PackageManagerInfo> {
        const response = await this.httpClient.request(getPackageManagerRoute, {
            params: { id: projectId }
        });
        return response.item;
    }

    public async clearCache(): Promise<void> {
        await this.httpClient.request(clearCacheRoute, { params: {} });
    }

    public async clearCachePackage(name: string): Promise<void> {
        await this.httpClient.request(clearPackageCacheRoute, { params: { packageName: name } });
    }
}

export const UpgradesGateway = Abstraction.createImplementation({
    implementation: UpgradesGatewayImpl,
    dependencies: [HTTPClient]
});
