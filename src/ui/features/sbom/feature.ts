import { createFeature } from "#shared/index.js";
import { SbomGateway } from "./SbomGateway.js";
import { SbomRepository } from "./SbomRepository.js";

export const SbomFeature = createFeature({
    name: "Ui/Sbom",
    register(container) {
        container.register(SbomGateway).inSingletonScope();
        container.register(SbomRepository).inSingletonScope();
    }
});
