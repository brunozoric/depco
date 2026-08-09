import { createFeature } from "#shared/index.js";
import { RouteRegistry } from "./RouteRegistry.js";

export const RouterFeature = createFeature({
    name: "Ui/Router",
    register(container) {
        container.register(RouteRegistry).inSingletonScope();
    }
});
