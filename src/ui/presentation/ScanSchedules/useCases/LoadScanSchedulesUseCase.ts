import { LoadScanSchedulesUseCase as Abstraction } from "./abstractions/LoadScanSchedulesUseCase.js";
import { ScanSchedulesGateway } from "../../../features/ScanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../features/ScanSchedules/abstractions/ScanSchedulesRepository.js";

class LoadScanSchedulesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: ScanSchedulesGateway.Interface,
        private readonly repository: ScanSchedulesRepository.Interface
    ) {}

    public execute = async (): Promise<void> => {
        const result = await this.gateway.list();
        this.repository.setSchedules(result.items);
        this.repository.setGlobalDefault(result.globalDefault);
    };
}

export const LoadScanSchedulesUseCase = Abstraction.createImplementation({
    implementation: LoadScanSchedulesUseCaseImpl,
    dependencies: [ScanSchedulesGateway, ScanSchedulesRepository]
});
