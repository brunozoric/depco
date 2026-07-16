import { createFeature } from "#shared/index.js";
import { ExportSbomUseCase } from "./ExportSbomUseCase.js";

export const SbomUseCasesFeature = createFeature({
    name: "Ui/SbomUseCases",
    register(container) {
        container.register(ExportSbomUseCase);
    }
});
