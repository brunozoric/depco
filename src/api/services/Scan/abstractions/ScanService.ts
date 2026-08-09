import { createAbstraction } from "#shared/index.js";
import type { IRegistryCacheProject } from "../../RegistryCache/abstractions/RegistryCacheService.js";

export type DependencyKind =
    | "dependency"
    | "devDependency"
    | "peerDependency"
    | "optionalDependency"
    | "transitive";

export interface IScanServiceDependency {
    name: string;
    currentVersion: string;
    latestInRange: string | null;
    latestVersion: string | null;
    dependencyKind: DependencyKind;
    upgradeType: "patch" | "minor" | "major" | "none" | null;
    registryResolved: boolean;
}

export interface IScanRegistryData {
    versions: string[];
    repoUrl: string | null;
    repoDirectory: string | null;
    time: Record<string, string>;
}

export interface IScanResult {
    dependencies: IScanServiceDependency[];
    registryData: Map<string, IScanRegistryData>;
    installedVersions: Map<string, string>;
}

export interface IScanService {
    scan(
        projectPath: string,
        packageManager: string,
        force?: boolean,
        onProgress?: (packageName: string, current: number, total: number) => void,
        signal?: AbortSignal,
        minimalAgeSeconds?: number,
        project?: IRegistryCacheProject
    ): Promise<IScanResult>;
}

export const ScanService = createAbstraction<IScanService>("Api/ScanService");

export namespace ScanService {
    export type Interface = IScanService;
    export type Dependency = IScanServiceDependency;
    export type Result = IScanResult;
    export type RegistryData = IScanRegistryData;
    export type DependencyKind = import("./ScanService.js").DependencyKind;
}
