import { createAbstraction } from "#shared/index.js";
import type { EngineStatus, IEngineStatusCounts, INodeRelease } from "#shared/engines/types.js";

export interface IEngineCheckItem {
    id: string;
    projectId: string;
    /** Empty string `""` represents the project's own (root) package.json. */
    packageName: string;
    enginesNode: string | null;
    minimumMajor: number | null;
    status: EngineStatus;
    eolDate: number | null;
    scannedAt: number;
}

export interface IProjectEngineSummaryItem {
    projectId: string;
    projectName: string;
    rootStatus: EngineStatus;
    rootEnginesNode: string | null;
    dependencyCounts: IEngineStatusCounts;
    lastScannedAt: number | null;
    engineScanStale: boolean;
    engineScanStaleReason: "time" | "release" | "both" | null;
}

export interface IEngineSummaryData {
    totalProjects: number;
    counts: IEngineStatusCounts;
    projectSummaries: IProjectEngineSummaryItem[];
    staleProjectCount: number;
    stalenessThresholdMs: number;
}

export interface IEngineListResponse {
    items: IEngineCheckItem[];
    total: number;
}

export interface IEngineScanResultData {
    rootStatus: EngineStatus;
    rootEnginesNode: string | null;
    findings: IEngineCheckItem[];
    summary: IEngineSummaryData;
}

export interface INodeReleaseListResponse {
    items: INodeRelease[];
    total: number;
}

export interface IEngineStalenessData {
    lastScannedAt: number | null;
    engineScanStale: boolean;
    engineScanStaleReason: "time" | "release" | "both" | null;
    stalenessThresholdMs: number;
}

export interface IBulkScanEnginesResult {
    scannedCount: number;
}

export interface IEnginesGateway {
    getByProject(projectId: string): Promise<IEngineListResponse>;
    getSummary(): Promise<IEngineSummaryData>;
    getStaleness(projectId: string): Promise<IEngineStalenessData>;
    scan(projectId: string): Promise<IEngineScanResultData>;
    bulkScanEngines(projectIds: string[]): Promise<IBulkScanEnginesResult>;
    getReleases(): Promise<INodeReleaseListResponse>;
}

export const EnginesGateway = createAbstraction<IEnginesGateway>("Ui/EnginesGateway");

export namespace EnginesGateway {
    export type Interface = IEnginesGateway;
    export type CheckItem = IEngineCheckItem;
    export type ProjectSummary = IProjectEngineSummaryItem;
    export type SummaryData = IEngineSummaryData;
    export type ListResponse = IEngineListResponse;
    export type ScanResult = IEngineScanResultData;
    export type NodeRelease = INodeRelease;
    export type NodeReleaseListResponse = INodeReleaseListResponse;
    export type StalenessData = IEngineStalenessData;
    export type BulkScanResult = IBulkScanEnginesResult;
}
