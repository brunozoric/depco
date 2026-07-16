import { UpdateScanScheduleUseCase as Abstraction } from "./abstractions/UpdateScanScheduleUseCase.js";
import { ScanSchedulesGateway } from "../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";

class UpdateScanScheduleUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: ScanSchedulesGateway.Interface,
        private readonly repository: ScanSchedulesRepository.Interface
    ) {}

    public execute = async (projectId: string, interval: string): Promise<void> => {
        await this.gateway.upsert(projectId, interval);
        this.repository.updateSchedule(projectId, interval, "project");
    };
}

export const UpdateScanScheduleUseCase = Abstraction.createImplementation({
    implementation: UpdateScanScheduleUseCaseImpl,
    dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
