import { createAbstraction } from "#shared/index.js";

export interface IUpgradePackageInput {
    name: string;
    targetVersion: string;
}

export interface IJob {
    id: string;
    referenceId: string;
    referenceType: string;
    type: "dependency" | "transient" | "yarn";
    status: "pending" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
    packages: string | null;
    logs: string | null;
    startedAt: number | null;
    completedAt: number | null;
    warning: string | null;
    progress: number | null;
    progressLabel: string | null;
}

export interface IJobHandle {
    jobId: string;
}

export interface IPackageManagerInfo {
    version: string;
}

export interface IUpgradesGateway {
    startUpgrade(
        projectId: string,
        packages: IUpgradePackageInput[],
        refreshTransient: boolean
    ): Promise<IJobHandle>;
    startTransient(projectId: string): Promise<IJobHandle>;
    getJob(projectId: string, jobId: string): Promise<IJob>;
    getJobs(projectId: string): Promise<IJob[]>;
    updatePackageManager(projectId: string, version: string): Promise<IJobHandle>;
    getPackageManagerInfo(projectId: string): Promise<IPackageManagerInfo>;
    clearCache(): Promise<void>;
    clearCachePackage(name: string): Promise<void>;
}

export const UpgradesGateway = createAbstraction<IUpgradesGateway>("Ui/UpgradesGateway");

export namespace UpgradesGateway {
    export type Interface = IUpgradesGateway;
    export type Job = IJob;
    export type UpgradePackageInput = IUpgradePackageInput;
    export type JobHandle = IJobHandle;
    export type PackageManagerInfo = IPackageManagerInfo;
}
