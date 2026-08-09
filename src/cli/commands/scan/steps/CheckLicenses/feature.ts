import { createFeature } from "#shared/index.js";
import { CheckLicensesStep } from "./CheckLicensesStep.js";

export const CheckLicensesStepFeature = createFeature({
    name: "Cli/CheckLicensesStep",
    register(container) {
        container.register(CheckLicensesStep).inSingletonScope();
    }
});
