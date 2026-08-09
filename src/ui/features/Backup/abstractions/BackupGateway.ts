import { createAbstraction } from "#shared/index.js";

export interface IBackupAppSetting {
    key: string;
    value: string;
}

export interface IBackupSecuritySetting {
    packageManager: string;
    configFile: string;
    fieldName: string;
    expectedValue: string;
}

export interface IBackupProject {
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
}

export interface IBackupChangelog {
    content: string | null;
    source: string | null;
}

export interface IBackupVersion {
    version: string;
    publishedAt: number | null;
    changelog?: IBackupChangelog | undefined;
}

export interface IBackupDependency {
    name: string;
    repoUrl: string | null;
    versions: IBackupVersion[];
}

export interface IBackupRegistryCache {
    packageName: string;
    data: string;
    cachedAt: number;
}

export interface IBackupPayload {
    version: 1;
    exportedAt: number;
    appSettings: IBackupAppSetting[];
    securitySettings: IBackupSecuritySetting[];
    projects: IBackupProject[];
    dependencies: IBackupDependency[];
    registryCache: IBackupRegistryCache[];
}

export interface IImportSectionResult {
    imported: number;
    skipped: number;
}

export interface IImportProjectsResult extends IImportSectionResult {
    failed: number;
    errors: string[];
}

export interface IImportResult {
    appSettings: IImportSectionResult;
    securitySettings: IImportSectionResult;
    projects: IImportProjectsResult;
    dependencies: IImportSectionResult;
    registryCache: IImportSectionResult;
}

export interface IBackupGateway {
    exportBackup(): Promise<IBackupPayload>;
    importBackup(payload: IBackupPayload): Promise<IImportResult>;
}

export const BackupGateway = createAbstraction<IBackupGateway>("Ui/BackupGateway");

export namespace BackupGateway {
    export type Interface = IBackupGateway;
    export type BackupPayload = IBackupPayload;
    export type BackupAppSetting = IBackupAppSetting;
    export type BackupSecuritySetting = IBackupSecuritySetting;
    export type BackupProject = IBackupProject;
    export type BackupChangelog = IBackupChangelog;
    export type BackupVersion = IBackupVersion;
    export type BackupDependency = IBackupDependency;
    export type BackupRegistryCache = IBackupRegistryCache;
    export type ImportResult = IImportResult;
    export type ImportSectionResult = IImportSectionResult;
    export type ImportProjectsResult = IImportProjectsResult;
}
