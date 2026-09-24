import { createFeature } from "#shared/index.js";
import { TeamFilterService } from "./TeamFilterService.js";
import { TeamListService } from "./TeamListService.js";
import { BrowserWindowFeature, LocalStorageCacheFeature } from "@webiny/stdlib/browser";

export const TeamFilterFeature = createFeature({
    name: "Ui/TeamFilter",
    register(container) {
        BrowserWindowFeature.register(container);
        LocalStorageCacheFeature.register(container);
        container.register(TeamFilterService).inSingletonScope();
        container.register(TeamListService).inSingletonScope();
    }
});
