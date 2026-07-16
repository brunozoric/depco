import { UpdateScanScheduleDefaultUseCase as Abstraction } from "./abstractions/UpdateScanScheduleDefaultUseCase.js";
import { ScanSchedulesGateway } from "../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";

class UpdateScanScheduleDefaultUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: ScanSchedulesGateway.Interface,
        private readonly repository: ScanSchedulesRepository.Interface
    ) {}

    public execute = async (interval: string): Promise<void> => {
        const result = await this.gateway.setDefault(interval);
        this.repository.setGlobalDefault(result);
    };
}

export const UpdateScanScheduleDefaultUseCase = Abstraction.createImplementation({
    implementation: UpdateScanScheduleDefaultUseCaseImpl,
    dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
