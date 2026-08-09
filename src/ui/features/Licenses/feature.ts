import { createFeature } from "#shared/index.js";
import { LicensesGateway } from "./LicensesGateway.js";
import { LicensesRepository } from "./LicensesRepository.js";

export const LicensesFeature = createFeature({
    name: "Ui/Licenses",
    register(container) {
        container.register(LicensesGateway).inSingletonScope();
        container.register(LicensesRepository).inSingletonScope();
    }
});
