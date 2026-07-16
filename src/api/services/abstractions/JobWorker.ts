import { createAbstraction } from "#shared/index.js";

export interface IDependencyUpgradePackage {
    name: string;
    from: string;
    to: string;
}

export interface IYarnUpgradePackage {
    from: string;
    to: string;
}

export interface IScanJobPackages {
    force?: boolean | undefined;
}

export interface IWaitForJobInput {
    jobId: string;
    signal?: AbortSignal | undefined;
}

export interface IWaitForJobsInput {
    jobIds: string[];
    signal?: AbortSignal | undefined;
}

export interface IGetRunningJobsForReferenceInput {
    referenceId: string;
    type: string;
}

export interface ICreateJobInput {
    referenceId: string;
    referenceType: "project" | "package";
    type:
        | "dependency"
        | "transient"
        | "packageManager"
        | "scan"
        | "clone"
        | "install"
        | "changelog"
        | "auto-fix-pr"
        | "transitive-resolve"
        | "package-scan"
        | "vulnerability-scan"
        | "license-scan"
        | "graph-refresh";
    packages?:
        | IDependencyUpgradePackage[]
        | IYarnUpgradePackage
        | IScanJobPackages
        | string
        | null
        | undefined;
    refreshTransient?: boolean | undefined;
    parentJobId?: string | undefined;
}

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
    parentJobId: string | null;
}

export interface IJobWorker {
    enqueue(input: ICreateJobInput): Promise<string>;
    getJob(jobId: string): Promise<IJob | null>;
    getJobsForReference(referenceId: string): Promise<IJob[]>;
    processNextJob(): Promise<void>;
    cancelJob(jobId: string): Promise<void>;
    listAllJobs(status?: string): Promise<IJob[]>;
    drain(): Promise<void>;
    recoverStaleJobs(): Promise<void>;
    waitForJob(input: IWaitForJobInput): Promise<IJob>;
    waitForJobs(input: IWaitForJobsInput): Promise<IJob[]>;
    getRunningJobsForReference(input: IGetRunningJobsForReferenceInput): Promise<IJob[]>;
}

export const JobWorker = createAbstraction<IJobWorker>("Api/JobWorker");

export namespace JobWorker {
    export type Interface = IJobWorker;
    export type CreateJobInput = ICreateJobInput;
    export type Job = IJob;
    export type DependencyUpgradePackage = IDependencyUpgradePackage;
    export type YarnUpgradePackage = IYarnUpgradePackage;
    export type ScanJobPackages = IScanJobPackages;
    export type WaitForJobInput = IWaitForJobInput;
    export type WaitForJobsInput = IWaitForJobsInput;
    export type GetRunningJobsForReferenceInput = IGetRunningJobsForReferenceInput;
}
