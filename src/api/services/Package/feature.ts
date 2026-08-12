import { createFeature } from "#shared/index.js";
import { PackageQueryService } from "./PackageQueryService.js";

export const PackageFeature = createFeature({
    name: "Api/PackageFeature",
    register(container) {
        container.register(PackageQueryService).inSingletonScope();
    }
});
