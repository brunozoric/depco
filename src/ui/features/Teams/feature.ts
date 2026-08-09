import { createFeature } from "#shared/index.js";
import { TeamsGateway } from "./TeamsGateway.js";
import { TeamsRepository } from "./TeamsRepository.js";

export const TeamsFeature = createFeature({
    name: "Ui/Teams",
    register(container) {
        container.register(TeamsGateway).inSingletonScope();
        container.register(TeamsRepository).inSingletonScope();
    }
});
