import { createFeature } from "#shared/index.js";
import { SbomService } from "./SbomService.js";
import { CycloneDxFormatter } from "./formatters/CycloneDxFormatter.js";
import { SpdxFormatter } from "./formatters/SpdxFormatter.js";
import { SbomFormatterRegistry } from "./SbomFormatterRegistry.js";

export const SbomFeature = createFeature({
    name: "Api/SbomFeature",
    register(container) {
        container.register(CycloneDxFormatter);
        container.register(SpdxFormatter);
        container.register(SbomFormatterRegistry).inSingletonScope();
        container.register(SbomService).inSingletonScope();
    }
});
