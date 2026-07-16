import { createFeature } from "#shared/index.js";
import { DependencyGraphFeature } from "../../../features/dependencyGraph/feature.js";
import { LoadDependencyGraphUseCase } from "./LoadDependencyGraphUseCase.js";
import { RefreshDependencyGraphUseCase } from "./RefreshDependencyGraphUseCase.js";

export const DependencyGraphUseCasesFeature = createFeature({
    name: "Ui/DependencyGraphUseCases",
    dependencies: [DependencyGraphFeature],
    register(container) {
        container.register(LoadDependencyGraphUseCase);
        container.register(RefreshDependencyGraphUseCase);
    }
});
