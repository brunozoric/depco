import { createFeature } from "#shared/index.js";
import { PackageManagerDriverRegistry } from "./PackageManagerDriverRegistry.js";
import { PackageManagerService } from "./PackageManagerService.js";

export const PackageManagerFeature = createFeature({
    name: "Api/PackageManagerFeature",
    register(container) {
        container.register(PackageManagerDriverRegistry).inSingletonScope();
        container.register(PackageManagerService).inSingletonScope();
    }
});
