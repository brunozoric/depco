import { LoadLicensesUseCase as Abstraction } from "./abstractions/LoadLicensesUseCase.js";
import { LicensesGateway } from "../../../features/licenses/abstractions/LicensesGateway.js";
import { LicensesRepository } from "../../../features/licenses/abstractions/LicensesRepository.js";

class LoadLicensesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: LicensesGateway.Interface,
        private readonly repository: LicensesRepository.Interface
    ) {}

    public execute = async (filters?: LicensesGateway.ListFilters): Promise<void> => {
        const teamId = filters?.teamId;
        const projectId = filters?.projectId;
        const violationFilters: LicensesGateway.ViolationListFilters = {
            ...(teamId ? { teamId } : {}),
            ...(projectId ? { projectId } : {})
        };
        const [licensesResponse, violationsResponse, summary] = await Promise.all([
            this.gateway.list(filters),
            this.gateway.listViolations(
                Object.keys(violationFilters).length > 0 ? violationFilters : undefined
            ),
            this.gateway.getSummary(teamId, projectId)
        ]);

        this.repository.setLicenses(licensesResponse.items, licensesResponse.total);
        this.repository.setViolations(violationsResponse.items, violationsResponse.total);
        this.repository.setSummary(summary);
    };
}

export const LoadLicensesUseCase = Abstraction.createImplementation({
    implementation: LoadLicensesUseCaseImpl,
    dependencies: [LicensesGateway, LicensesRepository]
});
