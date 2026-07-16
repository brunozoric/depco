import { createFeature } from "#shared/index.js";
import { HTTPClient } from "./HTTPClient.js";

export const HTTPClientFeature = createFeature({
    name: "Ui/HTTPClient",
    register(container) {
        container.register(HTTPClient).inSingletonScope();
    }
});
