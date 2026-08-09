import { createAbstraction } from "#shared/index.js";
import { ScanSchedulesGateway } from "./ScanSchedulesGateway.js";

export interface IScanSchedulesRepository {
    getSchedules(): ScanSchedulesGateway.ResolvedSchedule[];
    setSchedules(schedules: ScanSchedulesGateway.ResolvedSchedule[]): void;
    getSchedule(projectId: string): ScanSchedulesGateway.ResolvedSchedule | undefined;
    updateSchedule(projectId: string, interval: string, source: ScanSchedulesGateway.Source): void;
    getGlobalDefault(): string;
    setGlobalDefault(interval: string): void;
}

export const ScanSchedulesRepository = createAbstraction<IScanSchedulesRepository>(
    "Ui/ScanSchedulesRepository"
);

export namespace ScanSchedulesRepository {
    export type Interface = IScanSchedulesRepository;
}
