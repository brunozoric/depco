import { createFeature } from "#shared/index.js";
import { EventBridge } from "./EventBridge.js";

export const EventBridgeFeature = createFeature({
    name: "Ui/EventBridge",
    register(container) {
        container.register(EventBridge).inSingletonScope();
    }
});
