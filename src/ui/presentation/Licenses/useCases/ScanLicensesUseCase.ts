import { ScanLicensesUseCase as Abstraction } from "./abstractions/ScanLicensesUseCase.js";
import { LicensesGateway } from "../../../features/Licenses/abstractions/LicensesGateway.js";

class ScanLicensesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: LicensesGateway.Interface) {}

    public execute = async (projectId: string): Promise<LicensesGateway.ScanResult> => {
        return this.gateway.scan(projectId);
    };
}

export const ScanLicensesUseCase = Abstraction.createImplementation({
    implementation: ScanLicensesUseCaseImpl,
    dependencies: [LicensesGateway]
});
