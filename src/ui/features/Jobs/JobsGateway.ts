import { JobsGateway as Abstraction } from "./abstractions/JobsGateway.js";
import { HTTPClient } from "../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { listAllJobsRoute, cancelJobRoute, deleteJobsRoute } from "#shared/routes/index.js";
import { cleanQueryRecord } from "../../infrastructure/HttpClient/cleanQuery.js";
import type { z } from "zod";
import type { jobSchema } from "#shared/responses/jobs.js";

type IJobApiItem = z.infer<typeof jobSchema>;

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
        const query = cleanQueryRecord({
            status: filters.status,
            type: filters.type,
            referenceId: filters.referenceId,
            from: filters.from,
            to: filters.to,
            limit: limit !== undefined ? String(limit) : undefined,
            offset: offset !== undefined ? String(offset) : undefined
        });

        const response = await this.httpClient.request(listAllJobsRoute, {
            params: {},
            query
        });
        return { items: response.items.map(toJob), total: response.total };
    }

    public async deleteFiltered(filters: Abstraction.Filters): Promise<number> {
        const body = cleanQueryRecord({
            status: filters.status,
            type: filters.type,
            referenceId: filters.referenceId,
            from: filters.from,
            to: filters.to
        });

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
