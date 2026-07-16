import { ScanSchedulesRepository as Abstraction } from "./abstractions/ScanSchedulesRepository.js";
import type { ScanSchedulesGateway } from "./abstractions/ScanSchedulesGateway.js";

export class ScanSchedulesRepositoryImpl implements Abstraction.Interface {
    private schedules: ScanSchedulesGateway.ResolvedSchedule[] = [];
    private globalDefault = "disabled";

    public getSchedules(): ScanSchedulesGateway.ResolvedSchedule[] {
        return this.schedules;
    }

    public setSchedules(schedules: ScanSchedulesGateway.ResolvedSchedule[]): void {
        this.schedules = schedules;
    }

    public getSchedule(projectId: string): ScanSchedulesGateway.ResolvedSchedule | undefined {
        return this.schedules.find(schedule => schedule.projectId === projectId);
    }

    public updateSchedule(
        projectId: string,
        interval: string,
        source: ScanSchedulesGateway.Source
    ): void {
        const schedule = this.schedules.find(item => item.projectId === projectId);
        if (schedule) {
            schedule.interval = interval;
            schedule.source = source;
        }
    }

    public getGlobalDefault(): string {
        return this.globalDefault;
    }

    public setGlobalDefault(interval: string): void {
        this.globalDefault = interval;
    }
}

export const ScanSchedulesRepository = Abstraction.createImplementation({
    implementation: ScanSchedulesRepositoryImpl,
    dependencies: []
});
