import { createFeature } from "#shared/index.js";
import { ClearCacheUseCase } from "./ClearCacheUseCase.js";
import { ClearPackageCacheUseCase } from "./ClearPackageCacheUseCase.js";

export const CacheUseCasesFeature = createFeature({
    name: "Api/CacheUseCasesFeature",
    register(container) {
        container.register(ClearCacheUseCase);
        container.register(ClearPackageCacheUseCase);
    }
});
