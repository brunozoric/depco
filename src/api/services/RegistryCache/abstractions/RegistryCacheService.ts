import { createAbstraction } from "#shared/index.js";

export interface IRegistryCachePackageInfo {
    name: string;
    latestVersion: string;
    distTags: Record<string, string>;
    versions: string[];
    time: Record<string, string>;
    repoUrl: string | null;
    repoDirectory: string | null;
    readme: string | null;
    license: string | null;
}

export interface IRegistryCacheProject {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
}

export interface IRegistryCacheService {
    getPackageInfo(
        packageName: string,
        packageManager: string,
        force?: boolean,
        project?: IRegistryCacheProject
    ): Promise<IRegistryCachePackageInfo>;
    clearAll(): Promise<void>;
    clearPackage(packageName: string): Promise<void>;
}

export const RegistryCacheService = createAbstraction<IRegistryCacheService>(
    "Api/RegistryCacheService"
);

export namespace RegistryCacheService {
    export type Interface = IRegistryCacheService;
    export type PackageInfo = IRegistryCachePackageInfo;
    export type Project = IRegistryCacheProject;
}
