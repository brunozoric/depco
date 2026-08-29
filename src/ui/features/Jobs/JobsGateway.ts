import { JobsGateway as Abstraction } from "./abstractions/JobsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { listAllJobsRoute, cancelJobRoute, deleteJobsRoute } from "#shared/routes/index.js";

interface IJobApiItem {
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
    parentJobId?: string | null | undefined;
}

function toJob(item: IJobApiItem): Abstraction.Job {
    return {
        id: item.id,
        referenceId: item.referenceId,
        referenceType: item.referenceType,
        type: item.type,
        status: item.status,
        packages: item.packages,
        logs: item.logs,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        warning: item.warning ?? null,
        progress: item.progress,
        progressLabel: item.progressLabel,
        parentJobId: item.parentJobId ?? null
    };
}

class JobsGatewayImpl implements Abstraction.Interface {
    public constructor(private readonly httpClient: HTTPClient.Interface) {}

    public async listAll(
        filters: Abstraction.Filters,
        limit?: number,
        offset?: number
    ): Promise<Abstraction.ListResponse> {
        const query: Record<string, string> = {};
        if (filters.status) {
            query["status"] = filters.status;
        }
        if (filters.type) {
            query["type"] = filters.type;
        }
        if (filters.referenceId) {
            query["referenceId"] = filters.referenceId;
        }
        if (filters.from) {
            query["from"] = filters.from;
        }
        if (filters.to) {
            query["to"] = filters.to;
        }
        if (limit !== undefined) {
            query["limit"] = String(limit);
        }
        if (offset !== undefined) {
            query["offset"] = String(offset);
        }

        const response = await this.httpClient.request(listAllJobsRoute, {
            params: {},
            query
        });
        return { items: response.items.map(toJob), total: response.total };
    }

    public async deleteFiltered(filters: Abstraction.Filters): Promise<number> {
        const body: Record<string, string> = {};
        if (filters.status) {
            body["status"] = filters.status;
        }
        if (filters.type) {
            body["type"] = filters.type;
        }
        if (filters.referenceId) {
            body["referenceId"] = filters.referenceId;
        }
        if (filters.from) {
            body["from"] = filters.from;
        }
        if (filters.to) {
            body["to"] = filters.to;
        }

        const response = await this.httpClient.request(deleteJobsRoute, {
            params: {},
            body
        });
        return response.deleted;
    }

    public async cancel(jobId: string): Promise<void> {
        await this.httpClient.request(cancelJobRoute, {
            params: { jobId }
        });
    }
}

export const JobsGateway = Abstraction.createImplementation({
    implementation: JobsGatewayImpl,
    dependencies: [HTTPClient]
});
