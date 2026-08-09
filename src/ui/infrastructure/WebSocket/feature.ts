import { createFeature } from "#shared/index.js";
import { WebSocketListener } from "./WebSocketListener.js";
import { EventBridgeFeature } from "../Events/feature.js";

export const WebSocketFeature = createFeature({
    name: "Ui/WebSocket",
    dependencies: [EventBridgeFeature],
    register(container) {
        container.register(WebSocketListener).inSingletonScope();
    }
});
