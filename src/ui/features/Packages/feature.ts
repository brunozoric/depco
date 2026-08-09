import { createFeature } from "#shared/index.js";
import { PackagesGateway } from "./PackagesGateway.js";
import { PackagesRepository } from "./PackagesRepository.js";

export const PackagesFeature = createFeature({
    name: "Ui/Packages",
    register(container) {
        container.register(PackagesGateway).inSingletonScope();
        container.register(PackagesRepository).inSingletonScope();
    }
});
