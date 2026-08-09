import { createFeature } from "#shared/index.js";
import { AutoFixGateway } from "./AutoFixGateway.js";
import { AutoFixRepository } from "./AutoFixRepository.js";

export const AutoFixFeature = createFeature({
    name: "Ui/AutoFix",
    register(container) {
        container.register(AutoFixGateway).inSingletonScope();
        container.register(AutoFixRepository).inSingletonScope();
    }
});
