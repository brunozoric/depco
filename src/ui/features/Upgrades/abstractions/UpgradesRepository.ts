import { createAbstraction } from "#shared/index.js";
import { UpgradesGateway } from "./UpgradesGateway.js";

export interface IUpgradesRepository {
    getJobs(projectId: string): UpgradesGateway.Job[];
    setJobs(projectId: string, jobs: UpgradesGateway.Job[]): void;
    getActiveJob(projectId: string): UpgradesGateway.Job | undefined;
    setActiveJob(projectId: string, job: UpgradesGateway.Job | undefined): void;
    appendJobLog(projectId: string, line: string): void;
    getPackageManagerInfo(projectId: string): UpgradesGateway.PackageManagerInfo | undefined;
    setPackageManagerInfo(projectId: string, info: UpgradesGateway.PackageManagerInfo): void;
    clear(projectId: string): void;
}

export const UpgradesRepository = createAbstraction<IUpgradesRepository>("Ui/UpgradesRepository");

export namespace UpgradesRepository {
    export type Interface = IUpgradesRepository;
    export type Job = UpgradesGateway.Job;
    export type PackageManagerInfo = UpgradesGateway.PackageManagerInfo;
}
