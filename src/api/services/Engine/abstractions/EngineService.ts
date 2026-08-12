import { createAbstraction } from "#shared/index.js";
import type { EngineStatus, IEngineStatusCounts } from "#shared/engines/types.js";

export interface IEngineCheck {
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

/** Why an engine scan is considered stale: elapsed too much time since the last scan ("time"), a newer Node.js release has since been published ("release"), or both. */
export type EngineScanStaleReason = "time" | "release" | "both";

export interface IProjectEngineSummary {
    projectId: string;
    projectName: string;
    rootStatus: EngineStatus;
    rootEnginesNode: string | null;
    dependencyCounts: IEngineStatusCounts;
    lastScannedAt: number | null;
    engineScanStale: boolean;
    engineScanStaleReason: EngineScanStaleReason | null;
}

export interface IEngineSummary {
    totalProjects: number;
    counts: IEngineStatusCounts;
    projectSummaries: IProjectEngineSummary[];
    staleProjectCount: number;
    stalenessThresholdMs: number;
}

export interface IEngineScanResult {
    rootStatus: EngineStatus;
    rootEnginesNode: string | null;
    findings: IEngineCheck[];
    summary: IEngineSummary;
}

export interface IEngineScanInput {
    projectId: string;
    projectPath: string;
    /** When `false`, `maintenance`-status dependency findings are excluded from the scan result and persisted rows. Defaults to `true`. */
    warnMaintenance?: boolean;
}

export interface IEngineGetSummaryOptions {
    projectIds?: string[];
}

export interface IEngineService {
    scan(input: IEngineScanInput): Promise<IEngineScanResult>;
    getByProject(projectId: string): Promise<IEngineCheck[]>;
    getSummary(options?: IEngineGetSummaryOptions): Promise<IEngineSummary>;
}

export const EngineService = createAbstraction<IEngineService>("Api/EngineService");

export namespace EngineService {
    export type Interface = IEngineService;
    export type Check = IEngineCheck;
    export type ScanInput = IEngineScanInput;
    export type ScanResult = IEngineScanResult;
    export type Summary = IEngineSummary;
    export type ProjectSummary = IProjectEngineSummary;
    export type GetSummaryOptions = IEngineGetSummaryOptions;
    export type StaleReason = EngineScanStaleReason;
}
