import { createFeature } from "#shared/index.js";
import { EventBus } from "./EventBus.js";

export const EventBusFeature = createFeature({
    name: "Api/EventBusFeature",
    register(container) {
        container.register(EventBus).inSingletonScope();
    }
});
