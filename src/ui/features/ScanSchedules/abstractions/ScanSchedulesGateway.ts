import { createAbstraction } from "#shared/index.js";

export type ScanScheduleSource = "project" | "default";

export interface IResolvedSchedule {
    projectId: string;
    projectName: string;
    interval: string;
    source: ScanScheduleSource;
    lastRunAt: number | null;
    nextRunAt: number | null;
}

export interface IScheduleListResult {
    items: IResolvedSchedule[];
    globalDefault: string;
}

export interface IScanScheduleRow {
    id: string;
    projectId: string;
    interval: string;
    lastRunAt: number | null;
    nextRunAt: number | null;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface IScanSchedulesGateway {
    list(): Promise<IScheduleListResult>;
    upsert(projectId: string, interval: string): Promise<IScanScheduleRow>;
    remove(projectId: string): Promise<void>;
    getDefault(): Promise<string>;
    setDefault(interval: string): Promise<string>;
}

export const ScanSchedulesGateway =
    createAbstraction<IScanSchedulesGateway>("Ui/ScanSchedulesGateway");

export namespace ScanSchedulesGateway {
    export type Interface = IScanSchedulesGateway;
    export type Source = ScanScheduleSource;
    export type ResolvedSchedule = IResolvedSchedule;
    export type ScheduleListResult = IScheduleListResult;
    export type ScheduleRow = IScanScheduleRow;
}
