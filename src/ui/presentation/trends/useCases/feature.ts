import { createFeature } from "#shared/index.js";
import { LoadTrendsUseCase } from "./LoadTrendsUseCase.js";
import { LoadDependencyChangesUseCase } from "./LoadDependencyChangesUseCase.js";

export const TrendsUseCasesFeature = createFeature({
    name: "Ui/TrendsUseCases",
    register(container) {
        container.register(LoadTrendsUseCase);
        container.register(LoadDependencyChangesUseCase);
    }
});
