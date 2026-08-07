import { createFeature } from "#shared/index.js";
import { PackageJsonService } from "./PackageJsonService.js";

export const PackageJsonFeature = createFeature({
    name: "Api/PackageJsonFeature",
    register(container) {
        container.register(PackageJsonService).inSingletonScope();
    }
});
