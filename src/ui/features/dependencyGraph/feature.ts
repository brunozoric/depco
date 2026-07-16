import { createFeature } from "#shared/index.js";
import { DependencyGraphGateway } from "./DependencyGraphGateway.js";
import { DependencyGraphRepository } from "./DependencyGraphRepository.js";

export const DependencyGraphFeature = createFeature({
    name: "Ui/DependencyGraph",
    register(container) {
        container.register(DependencyGraphGateway).inSingletonScope();
        container.register(DependencyGraphRepository).inSingletonScope();
    }
});
