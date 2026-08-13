import { createFeature } from "#shared/index.js";
import { GetDependencyGraphUseCase } from "./GetDependencyGraphUseCase.js";
import { SearchDependencyPackagesUseCase } from "./SearchDependencyPackagesUseCase.js";
import { RefreshDependencyGraphUseCase } from "./RefreshDependencyGraphUseCase.js";
import { GetDependencyGraphStatsUseCase } from "./GetDependencyGraphStatsUseCase.js";

export const DependencyGraphUseCasesFeature = createFeature({
    name: "Api/DependencyGraphUseCasesFeature",
    register(container) {
        container.register(GetDependencyGraphUseCase);
        container.register(SearchDependencyPackagesUseCase);
        container.register(RefreshDependencyGraphUseCase);
        container.register(GetDependencyGraphStatsUseCase);
    }
});
