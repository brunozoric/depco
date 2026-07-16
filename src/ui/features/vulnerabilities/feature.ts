import { createFeature } from "#shared/index.js";
import { VulnerabilitiesGateway } from "./VulnerabilitiesGateway.js";
import { VulnerabilitiesRepository } from "./VulnerabilitiesRepository.js";

export const VulnerabilitiesFeature = createFeature({
    name: "Ui/Vulnerabilities",
    register(container) {
        container.register(VulnerabilitiesGateway).inSingletonScope();
        container.register(VulnerabilitiesRepository).inSingletonScope();
    }
});
