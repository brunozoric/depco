import { JobsRepository as Abstraction } from "./abstractions/JobsRepository.js";

class JobsRepositoryImpl implements Abstraction.Interface {
    private jobs: Abstraction.Job[] = [];
    private total = 0;

    public getJobs(): Abstraction.Job[] {
        return this.jobs;
    }

    public setJobs(jobs: Abstraction.Job[]): void {
        this.jobs = jobs;
    }

    public getTotal(): number {
        return this.total;
    }

    public setTotal(total: number): void {
        this.total = total;
    }

    public updateJobStatus(id: string, status: string): void {
        this.jobs = this.jobs.map(job => (job.id === id ? { ...job, status } : job));
    }

    public updateJobProgress(id: string, progress: number, progressLabel: string | null): void {
        this.jobs = this.jobs.map(job =>
            job.id === id ? { ...job, progress, progressLabel } : job
        );
    }
}

export const JobsRepository = Abstraction.createImplementation({
    implementation: JobsRepositoryImpl,
    dependencies: []
});
