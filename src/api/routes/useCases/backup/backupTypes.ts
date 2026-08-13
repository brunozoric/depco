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

export interface IBackupProjectEntry {
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
}

export interface IBackupChangelogEntry {
    content: string | null;
    source: string | null;
}

export interface IBackupVersionEntry {
    version: string;
    publishedAt: number | null;
    changelog?: IBackupChangelogEntry | undefined;
}

export interface IBackupDependencyEntry {
    name: string;
    repoUrl: string | null;
    versions: IBackupVersionEntry[];
}

export interface IBackupRegistryCacheEntry {
    packageName: string;
    data: string;
    cachedAt: number;
}

export interface IBackupPayload {
    version: number;
    exportedAt: number;
    appSettings: IBackupAppSetting[];
    securitySettings: IBackupSecuritySetting[];
    projects: IBackupProjectEntry[];
    dependencies: IBackupDependencyEntry[];
    registryCache: IBackupRegistryCacheEntry[];
}

export interface IImportSectionResult {
    imported: number;
    skipped: number;
}

export interface IImportProjectsResult extends IImportSectionResult {
    failed: number;
    errors: string[];
}

export interface IImportBackupResult {
    appSettings: IImportSectionResult;
    securitySettings: IImportSectionResult;
    projects: IImportProjectsResult;
    dependencies: IImportSectionResult;
    registryCache: IImportSectionResult;
}
