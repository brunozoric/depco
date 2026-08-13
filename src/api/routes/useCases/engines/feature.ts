import { createFeature } from "#shared/index.js";
import { GetEngineSummaryUseCase } from "./GetEngineSummaryUseCase.js";
import { ListNodeReleasesUseCase } from "./ListNodeReleasesUseCase.js";
import { GetProjectEngineChecksUseCase } from "./GetProjectEngineChecksUseCase.js";
import { GetProjectEngineStalenessUseCase } from "./GetProjectEngineStalenessUseCase.js";
import { ScanProjectEnginesUseCase } from "./ScanProjectEnginesUseCase.js";

export const EnginesUseCasesFeature = createFeature({
    name: "Api/EnginesUseCasesFeature",
    register(container) {
        container.register(GetEngineSummaryUseCase);
        container.register(ListNodeReleasesUseCase);
        container.register(GetProjectEngineChecksUseCase);
        container.register(GetProjectEngineStalenessUseCase);
        container.register(ScanProjectEnginesUseCase);
    }
});
