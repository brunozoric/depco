export type EngineStatus = "current" | "active-lts" | "maintenance" | "eol" | "unknown";

export interface INodeRelease {
    version: number;
    codename: string | null;
    releaseDate: number;
    ltsStart: number | null;
    maintenanceStart: number | null;
    eolDate: number;
}

export interface IEngineClassification {
    status: EngineStatus;
    eolDate: number | null;
    codename: string | null;
}

export interface IEngineStatusCounts {
    eol: number;
    maintenance: number;
    activeLts: number;
    current: number;
    unknown: number;
}

export interface IClassifyNodeVersionInput {
    majorVersion: number;
    schedule: INodeRelease[];
    now?: number;
}
