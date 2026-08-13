import { createFeature } from "#shared/index.js";
import { ListLicensesUseCase } from "./ListLicensesUseCase.js";
import { GetLicenseSummaryUseCase } from "./GetLicenseSummaryUseCase.js";
import { GetProjectLicensesUseCase } from "./GetProjectLicensesUseCase.js";
import { ScanProjectLicensesUseCase } from "./ScanProjectLicensesUseCase.js";
import { ListLicenseViolationsUseCase } from "./ListLicenseViolationsUseCase.js";
import { GetLicenseViolationsSummaryUseCase } from "./GetLicenseViolationsSummaryUseCase.js";
import { ListLicensePoliciesUseCase } from "./ListLicensePoliciesUseCase.js";
import { CreateLicensePolicyUseCase } from "./CreateLicensePolicyUseCase.js";
import { UpdateLicensePolicyUseCase } from "./UpdateLicensePolicyUseCase.js";
import { DeleteLicensePolicyUseCase } from "./DeleteLicensePolicyUseCase.js";

export const LicensesUseCasesFeature = createFeature({
    name: "Api/LicensesUseCasesFeature",
    register(container) {
        container.register(ListLicensesUseCase);
        container.register(GetLicenseSummaryUseCase);
        container.register(GetProjectLicensesUseCase);
        container.register(ScanProjectLicensesUseCase);
        container.register(ListLicenseViolationsUseCase);
        container.register(GetLicenseViolationsSummaryUseCase);
        container.register(ListLicensePoliciesUseCase);
        container.register(CreateLicensePolicyUseCase);
        container.register(UpdateLicensePolicyUseCase);
        container.register(DeleteLicensePolicyUseCase);
    }
});
