import { createFeature } from "#shared/index.js";
import { ListPackagesUseCase } from "./ListPackagesUseCase.js";
import { GetPackageDetailUseCase } from "./GetPackageDetailUseCase.js";
import { RescanPackageUseCase } from "./RescanPackageUseCase.js";

export const PackagesUseCasesFeature = createFeature({
    name: "Api/PackagesUseCasesFeature",
    register(container) {
        container.register(ListPackagesUseCase);
        container.register(GetPackageDetailUseCase);
        container.register(RescanPackageUseCase);
    }
});
