import { createFeature } from "#shared/index.js";
import { LoggerService } from "./LoggerService.js";

export const LoggerFeature = createFeature({
    name: "Api/LoggerFeature",
    register(container) {
        container.register(LoggerService).inSingletonScope();
    }
});
