import { createAbstraction } from "#shared/index.js";

export interface IJob {
    id: string;
    referenceId: string;
    referenceType: string;
    type: string;
    status: string;
    packages: string | null;
    logs: string | null;
    startedAt: number | null;
    completedAt: number | null;
    warning: string | null;
    progress: number | null;
    progressLabel: string | null;
    parentJobId: string | null;
}

export interface IJobFilters {
    status?: string;
    type?: string;
    referenceId?: string;
    from?: string;
    to?: string;
}

export interface IJobListResponse {
    items: IJob[];
    total: number;
}

export interface IJobsGateway {
    listAll(filters: IJobFilters, limit?: number, offset?: number): Promise<IJobListResponse>;
    deleteFiltered(filters: IJobFilters): Promise<number>;
    cancel(jobId: string): Promise<void>;
}

export const JobsGateway = createAbstraction<IJobsGateway>("Ui/JobsGateway");

export namespace JobsGateway {
    export type Interface = IJobsGateway;
    export type Job = IJob;
    export type Filters = IJobFilters;
    export type ListResponse = IJobListResponse;
}
