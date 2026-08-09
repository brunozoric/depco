import { ResetScanScheduleUseCase as Abstraction } from "./abstractions/ResetScanScheduleUseCase.js";
import { ScanSchedulesGateway } from "../../../features/ScanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/ScanSchedules/abstractions/ScanSchedulesRepository.js";

class ResetScanScheduleUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: ScanSchedulesGateway.Interface,
        private readonly repository: ScanSchedulesRepository.Interface
    ) {}

    public execute = async (projectId: string): Promise<void> => {
        await this.gateway.remove(projectId);
        const globalDefault = this.repository.getGlobalDefault();
        this.repository.updateSchedule(projectId, globalDefault, "default");
    };
}

export const ResetScanScheduleUseCase = Abstraction.createImplementation({
    implementation: ResetScanScheduleUseCaseImpl,
    dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
