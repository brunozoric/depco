import { createAbstraction } from "#shared/index.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import type { IChangelogEntry } from "#shared/changelog/types.js";

export type { IInstallFlagDefinition };

export interface IProjectTeam {
    id: string;
    name: string;
    color: string;
}

export interface IProject {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: number | null;
    security?: ISecurityStatus | null;
    hasNodeModules: boolean;
    teams?: IProjectTeam[];
}

export interface IDependency {
    name: string;
    currentVersion: string;
    latestInRange: string;
    latestVersion: string;
    type: string;
    upgradeType: "patch" | "minor" | "major" | "none";
    dependencyKind: string;
    registryResolved: boolean;
}

export interface ISecurityStatus {
    passes: boolean;
    checks: Record<string, boolean>;
}

export interface IDependenciesResponse {
    dependencies: IDependency[];
    lastScannedAt: number | null;
}

export interface IScanJob {
    jobId: string;
}

export interface IChangelogResult {
    entries: IChangelogEntry[];
    resolving: boolean;
}

export interface IProjectsGateway {
    list(): Promise<IProject[]>;
    get(id: string): Promise<IProject>;
    create(path: string): Promise<IProject>;
    remove(id: string): Promise<void>;
    scan(id: string, force?: boolean): Promise<IScanJob>;
    getDependencies(id: string): Promise<IDependenciesResponse>;
    getSecurity(id: string): Promise<ISecurityStatus>;
    checkSecurity(id: string): Promise<ISecurityStatus>;
    clone(url: string, destination: string, folderName?: string): Promise<IScanJob>;
    install(id: string, flags?: string[]): Promise<IScanJob>;
    getInstallOptions(packageManager: string): Promise<IInstallFlagDefinition[]>;
    getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogResult>;
    reResolveChangelogs(packageName: string, from: string, to: string): Promise<IChangelogResult>;
}

export const ProjectsGateway = createAbstraction<IProjectsGateway>("Ui/ProjectsGateway");

export namespace ProjectsGateway {
    export type Interface = IProjectsGateway;
    export type Project = IProject;
    export type Dependency = IDependency;
    export type SecurityStatus = ISecurityStatus;
    export type DependenciesResponse = IDependenciesResponse;
    export type ScanJob = IScanJob;
    export type InstallFlagDefinition = IInstallFlagDefinition;
    export type ChangelogEntry = IChangelogEntry;
    export type ChangelogResult = IChangelogResult;
}
