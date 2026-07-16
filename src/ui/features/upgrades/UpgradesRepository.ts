import { UpgradesRepository as Abstraction } from "./abstractions/UpgradesRepository.js";

class UpgradesRepositoryImpl implements Abstraction.Interface {
    private readonly jobs = new Map<string, Abstraction.Job[]>();
    private readonly activeJobs = new Map<string, Abstraction.Job>();
    private readonly packageManagerInfo = new Map<string, Abstraction.PackageManagerInfo>();

    public getJobs(projectId: string): Abstraction.Job[] {
        return this.jobs.get(projectId) ?? [];
    }

    public setJobs(projectId: string, jobs: Abstraction.Job[]): void {
        this.jobs.set(projectId, jobs);
    }

    public getActiveJob(projectId: string): Abstraction.Job | undefined {
        return this.activeJobs.get(projectId);
    }

    public setActiveJob(projectId: string, job: Abstraction.Job | undefined): void {
        if (job === undefined) {
            this.activeJobs.delete(projectId);
        } else {
            this.activeJobs.set(projectId, job);
        }
    }

    public appendJobLog(projectId: string, line: string): void {
        const job = this.activeJobs.get(projectId);
        if (job) {
            const existing = job.logs ?? "";
            const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
            job.logs = `${existing}${separator}${line}\n`;
        }
    }

    public getPackageManagerInfo(projectId: string): Abstraction.PackageManagerInfo | undefined {
        return this.packageManagerInfo.get(projectId);
    }

    public setPackageManagerInfo(projectId: string, info: Abstraction.PackageManagerInfo): void {
        this.packageManagerInfo.set(projectId, info);
    }

    public clear(projectId: string): void {
        this.jobs.delete(projectId);
        this.activeJobs.delete(projectId);
        this.packageManagerInfo.delete(projectId);
    }
}

export const UpgradesRepository = Abstraction.createImplementation({
    implementation: UpgradesRepositoryImpl,
    dependencies: []
});
