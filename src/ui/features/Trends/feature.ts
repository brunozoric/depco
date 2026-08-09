import { createFeature } from "#shared/index.js";
import { TrendsGateway } from "./TrendsGateway.js";
import { TrendsRepository } from "./TrendsRepository.js";

export const TrendsFeature = createFeature({
    name: "Ui/Trends",
    register(container) {
        container.register(TrendsGateway).inSingletonScope();
        container.register(TrendsRepository).inSingletonScope();
    }
});
