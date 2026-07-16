import { createFeature } from "#shared/index.js";
import { UpgradesGateway } from "./UpgradesGateway.js";
import { UpgradesRepository } from "./UpgradesRepository.js";

export const UpgradesFeature = createFeature({
    name: "Ui/Upgrades",
    register(container) {
        container.register(UpgradesGateway).inSingletonScope();
        container.register(UpgradesRepository).inSingletonScope();
    }
});
