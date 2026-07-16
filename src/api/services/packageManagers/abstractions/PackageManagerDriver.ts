import { createAbstraction } from "#shared/index.js";
import type { PackageManagerId } from "#shared/security/types.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";

export interface ICommandSpec {
    command: string;
    args: string[];
}

export interface IWorkspaceEntry {
    location: string;
}

export interface IRegistryPackageInfo {
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

export interface IPackageManagerDriver {
    readonly id: PackageManagerId;
    readonly lockfileName: string;

    versionCommand(): ICommandSpec;
    updateVersionCommand(version: string): ICommandSpec;

    installedVersionsCommand(): ICommandSpec;
    parseInstalledVersions(stdout: string): Map<string, string>;
    workspacesCommand(): ICommandSpec | null;
    parseWorkspaces(stdout: string): IWorkspaceEntry[];

    upgradePackageCommand(packageName: string, targetVersion: string): ICommandSpec;
    refreshTransientCommand(packageNames?: string[]): ICommandSpec;

    registryInfoCommand(packageName: string, registryUrl?: string): ICommandSpec;
    parseRegistryInfo(stdout: string): IRegistryPackageInfo;

    installFlags(): IInstallFlagDefinition[];
    installCommand(flags: string[]): ICommandSpec;

    auditCommand(): ICommandSpec;
}

export const PackageManagerDriver = createAbstraction<IPackageManagerDriver>(
    "Api/PackageManagerDriver"
);

export namespace PackageManagerDriver {
    export type Interface = IPackageManagerDriver;
    export type CommandSpec = ICommandSpec;
    export type WorkspaceEntry = IWorkspaceEntry;
    export type RegistryPackageInfo = IRegistryPackageInfo;
    export type InstallFlagDefinition = IInstallFlagDefinition;
}
