import { createAbstraction } from "#shared/index.js";

export interface IAutoFixSettings {
    id: string;
    projectId: string;
    enabled: boolean;
    upgradeTypes: string[];
    groupingStrategy: string;
    branchPrefix: string;
    createdAt: number;
    updatedAt: number;
}

export interface IAutoFixPullRequest {
    id: string;
    projectId: string;
    packageNames: string[];
    fromVersions: Record<string, string>;
    toVersions: Record<string, string>;
    upgradeType: string;
    branchName: string;
    prUrl: string | null;
    prNumber: number | null;
    status: string;
    licenseWarnings: string[];
    createdAt: number;
    updatedAt: number;
}

export interface IUpdateAutoFixSettingsInput {
    enabled?: boolean;
    upgradeTypes?: string[];
    groupingStrategy?: string;
    branchPrefix?: string;
}

export interface IAutoFixPullRequestListFilters {
    projectId?: string;
    status?: string;
}

export interface IAutoFixProjectPullRequestListFilters {
    status?: string;
}

export interface IAutoFixPullRequestListResponse {
    items: IAutoFixPullRequest[];
    total: number;
}

export interface IGenerateAutoFixResult {
    jobId: string;
}

export interface IDeleteAutoFixPullRequestResult {
    deleted: boolean;
}

export interface IAutoFixGateway {
    getSettings(projectId: string): Promise<IAutoFixSettings>;
    updateSettings(
        projectId: string,
        input: IUpdateAutoFixSettingsInput
    ): Promise<IAutoFixSettings>;
    listPullRequests(
        filters?: IAutoFixPullRequestListFilters
    ): Promise<IAutoFixPullRequestListResponse>;
    getProjectPullRequests(
        projectId: string,
        filters?: IAutoFixProjectPullRequestListFilters
    ): Promise<IAutoFixPullRequestListResponse>;
    generate(projectId: string): Promise<IGenerateAutoFixResult>;
    deletePullRequest(id: string): Promise<IDeleteAutoFixPullRequestResult>;
}

export const AutoFixGateway = createAbstraction<IAutoFixGateway>("Ui/AutoFixGateway");

export namespace AutoFixGateway {
    export type Interface = IAutoFixGateway;
    export type Settings = IAutoFixSettings;
    export type PullRequest = IAutoFixPullRequest;
    export type UpdateSettingsInput = IUpdateAutoFixSettingsInput;
    export type PullRequestListFilters = IAutoFixPullRequestListFilters;
    export type ProjectPullRequestListFilters = IAutoFixProjectPullRequestListFilters;
    export type PullRequestListResponse = IAutoFixPullRequestListResponse;
    export type GenerateResult = IGenerateAutoFixResult;
    export type DeletePullRequestResult = IDeleteAutoFixPullRequestResult;
}
