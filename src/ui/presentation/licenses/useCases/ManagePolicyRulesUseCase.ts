import { ManagePolicyRulesUseCase as Abstraction } from "./abstractions/ManagePolicyRulesUseCase.js";
import { LicensesGateway } from "../../../features/licenses/abstractions/LicensesGateway.js";
import { LicensesRepository } from "../../../features/licenses/abstractions/LicensesRepository.js";

class ManagePolicyRulesUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: LicensesGateway.Interface,
        private readonly repository: LicensesRepository.Interface
    ) {}

    public create = async (input: LicensesGateway.CreatePolicyInput): Promise<void> => {
        await this.gateway.createPolicy(input);
        await this.refreshPolicies();
    };

    public update = async (id: string, input: LicensesGateway.UpdatePolicyInput): Promise<void> => {
        await this.gateway.updatePolicy(id, input);
        await this.refreshPolicies();
    };

    public remove = async (id: string): Promise<void> => {
        await this.gateway.deletePolicy(id);
        await this.refreshPolicies();
    };

    private refreshPolicies = async (): Promise<void> => {
        const response = await this.gateway.listPolicies();
        this.repository.setPolicies(response.items);
    };
}

export const ManagePolicyRulesUseCase = Abstraction.createImplementation({
    implementation: ManagePolicyRulesUseCaseImpl,
    dependencies: [LicensesGateway, LicensesRepository]
});
