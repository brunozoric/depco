import { createFeature } from "#shared/index.js";
import { ConsoleEmailService } from "./ConsoleEmailService.js";

export const EmailFeature = createFeature({
    name: "Api/EmailFeature",
    register(container) {
        container.register(ConsoleEmailService).inSingletonScope();
    }
});
