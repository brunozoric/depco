import { createFeature } from "#shared/index.js";
import { UpgradesFeature } from "../../../features/Upgrades/feature.js";
import { GetJobUseCase } from "./GetJobUseCase.js";
import { GetJobsUseCase } from "./GetJobsUseCase.js";
import { RefreshTransientUseCase } from "./RefreshTransientUseCase.js";
import { UpdatePackageManagerUseCase } from "./UpdatePackageManagerUseCase.js";
import { UpgradePackagesUseCase } from "./UpgradePackagesUseCase.js";

export const UpgradesUseCasesFeature = createFeature({
    name: "Ui/UpgradesUseCases",
    dependencies: [UpgradesFeature],
    register(container) {
        container.register(GetJobUseCase);
        container.register(GetJobsUseCase);
        container.register(RefreshTransientUseCase);
        container.register(UpdatePackageManagerUseCase);
        container.register(UpgradePackagesUseCase);
    }
});
