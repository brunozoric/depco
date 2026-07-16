import { createAbstraction } from "#shared/index.js";
import { JobsGateway } from "./JobsGateway.js";

export interface IJobsRepository {
    getJobs(): JobsGateway.Job[];
    setJobs(jobs: JobsGateway.Job[]): void;
    getTotal(): number;
    setTotal(total: number): void;
    updateJobStatus(id: string, status: string): void;
    updateJobProgress(id: string, progress: number, progressLabel: string | null): void;
}

export const JobsRepository = createAbstraction<IJobsRepository>("Ui/JobsRepository");

export namespace JobsRepository {
    export type Interface = IJobsRepository;
    export type Job = JobsGateway.Job;
}
