import { createFeature } from "#shared/index.js";
import { EnginesGateway } from "./EnginesGateway.js";
import { EnginesRepository } from "./EnginesRepository.js";

export const EnginesFeature = createFeature({
    name: "Ui/Engines",
    register(container) {
        container.register(EnginesGateway).inSingletonScope();
        container.register(EnginesRepository).inSingletonScope();
    }
});
