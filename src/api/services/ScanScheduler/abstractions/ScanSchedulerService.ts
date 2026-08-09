import { createAbstraction } from "#shared/index.js";

export interface IScanSchedulerService {
    init(): Promise<void>;
    stop(): Promise<void>;
    scheduleProject(projectId: string): Promise<void>;
    unscheduleProject(projectId: string): Promise<void>;
    onGlobalDefaultChanged(): Promise<void>;
    onScanComplete(projectId: string): Promise<void>;
}

export const ScanSchedulerService = createAbstraction<IScanSchedulerService>(
    "Api/ScanSchedulerService"
);

export namespace ScanSchedulerService {
    export type Interface = IScanSchedulerService;
}
