import { createFeature } from "#shared/index.js";
import { PackagesFeature } from "../../../features/packages/feature.js";
import { LoadPackagesUseCase } from "./LoadPackagesUseCase.js";

export const PackagesUseCasesFeature = createFeature({
    name: "Ui/PackagesUseCases",
    dependencies: [PackagesFeature],
    register(container) {
        container.register(LoadPackagesUseCase);
    }
});
