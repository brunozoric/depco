import { createAbstraction } from "#shared/index.js";

export interface IPackageUpgrade {
    packageName: string;
    fromVersion: string;
    toVersion: string;
    upgradeType: string;
}

export interface IChangelogExcerpt {
    packageName: string;
    version: string;
    content: string | null;
}

export interface IAutoFixGenerateResult {
    pending: IAutoFixPullRequestRecord[];
    skippedDeny: string[];
    skippedDuplicate: string[];
}

export interface IAutoFixPullRequestRecord {
    id: string;
    projectId: string;
    packageNames: string[];
    fromVersions: Record<string, string>;
    toVersions: Record<string, string>;
    upgradeType: string;
    branchName: string;
    status: string;
    licenseWarnings: string[];
}

export interface IAutoFixPrService {
    generateForProject(projectId: string): Promise<IAutoFixGenerateResult>;
    buildPrBody(
        packages: IPackageUpgrade[],
        changelogs: IChangelogExcerpt[],
        licenseWarnings: string[]
    ): string;
}

export const AutoFixPrService = createAbstraction<IAutoFixPrService>("Api/AutoFixPrService");

export namespace AutoFixPrService {
    export type Interface = IAutoFixPrService;
    export type PackageUpgrade = IPackageUpgrade;
    export type ChangelogExcerpt = IChangelogExcerpt;
    export type GenerateResult = IAutoFixGenerateResult;
    export type PullRequestRecord = IAutoFixPullRequestRecord;
}
