import { createFeature } from "#shared/index.js";
import { LocalStorageCacheFeature } from "@webiny/stdlib/browser";
import { AuthGateway } from "./AuthGateway.js";
import { AuthRepository } from "./AuthRepository.js";

export const AuthFeature = createFeature({
    name: "Ui/Auth",
    register(container) {
        LocalStorageCacheFeature.register(container);
        container.register(AuthGateway).inSingletonScope();
        container.register(AuthRepository).inSingletonScope();
    }
});
