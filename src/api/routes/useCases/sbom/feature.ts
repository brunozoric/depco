import { createFeature } from "#shared/index.js";
import { ExportAllSbomUseCase } from "./ExportAllSbomUseCase.js";
import { ExportProjectSbomUseCase } from "./ExportProjectSbomUseCase.js";

export const SbomUseCasesFeature = createFeature({
    name: "Api/SbomUseCasesFeature",
    register(container) {
        container.register(ExportAllSbomUseCase);
        container.register(ExportProjectSbomUseCase);
    }
});
