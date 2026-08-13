import { createFeature } from "#shared/index.js";
import { GetPackageManagerUseCase } from "./GetPackageManagerUseCase.js";
import { UpdatePackageManagerUseCase } from "./UpdatePackageManagerUseCase.js";

export const PackageManagerUseCasesFeature = createFeature({
    name: "Api/PackageManagerUseCasesFeature",
    register(container) {
        container.register(GetPackageManagerUseCase);
        container.register(UpdatePackageManagerUseCase);
    }
});
