import { createFeature } from "#shared/index.js";
import { UpgradeJobUseCase } from "./UpgradeJobUseCase.js";
import { CreateTransientJobUseCase } from "./CreateTransientJobUseCase.js";
import { GetJobUseCase } from "./GetJobUseCase.js";
import { ListProjectJobsUseCase } from "./ListProjectJobsUseCase.js";
import { ListAllJobsUseCase } from "./ListAllJobsUseCase.js";
import { CancelJobUseCase } from "./CancelJobUseCase.js";
import { DeleteJobsUseCase } from "./DeleteJobsUseCase.js";

export const JobsUseCasesFeature = createFeature({
    name: "Api/JobsUseCasesFeature",
    register(container) {
        container.register(UpgradeJobUseCase);
        container.register(CreateTransientJobUseCase);
        container.register(GetJobUseCase);
        container.register(ListProjectJobsUseCase);
        container.register(ListAllJobsUseCase);
        container.register(CancelJobUseCase);
        container.register(DeleteJobsUseCase);
    }
});
