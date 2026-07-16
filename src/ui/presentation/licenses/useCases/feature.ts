import { createFeature } from "#shared/index.js";
import { LicensesFeature } from "../../../features/licenses/feature.js";
import { LoadLicensesUseCase } from "./LoadLicensesUseCase.js";
import { ManagePolicyRulesUseCase } from "./ManagePolicyRulesUseCase.js";
import { ScanLicensesUseCase } from "./ScanLicensesUseCase.js";

export const LicensesUseCasesFeature = createFeature({
    name: "Ui/LicensesUseCases",
    dependencies: [LicensesFeature],
    register(container) {
        container.register(LoadLicensesUseCase);
        container.register(ManagePolicyRulesUseCase);
        container.register(ScanLicensesUseCase);
    }
});
