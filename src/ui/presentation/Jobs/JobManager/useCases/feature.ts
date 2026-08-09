import { createFeature } from "#shared/index.js";
import { JobsFeature } from "../../../../features/Jobs/feature.js";
import { LoadAllJobsUseCase } from "./LoadAllJobsUseCase.js";
import { CancelJobUseCase } from "./CancelJobUseCase.js";
import { DeleteJobsUseCase } from "./DeleteJobsUseCase.js";

export const JobManagerUseCasesFeature = createFeature({
    name: "Ui/JobManagerUseCases",
    dependencies: [JobsFeature],
    register(container) {
        container.register(LoadAllJobsUseCase);
        container.register(CancelJobUseCase);
        container.register(DeleteJobsUseCase);
    }
});
