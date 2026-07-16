import { createFeature } from "#shared/index.js";
import { PackageManagerDriverRegistry } from "./PackageManagerDriverRegistry.js";

export const PackageManagerDriverFeature = createFeature({
    name: "Api/PackageManagerDriverFeature",
    register(container) {
        container.register(PackageManagerDriverRegistry).inSingletonScope();
    }
});
