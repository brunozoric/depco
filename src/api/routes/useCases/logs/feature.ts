import { createFeature } from "#shared/index.js";
import { ListLogsUseCase } from "./ListLogsUseCase.js";
import { DeleteLogsUseCase } from "./DeleteLogsUseCase.js";

export const LogsUseCasesFeature = createFeature({
    name: "Api/LogsUseCasesFeature",
    register(container) {
        container.register(ListLogsUseCase);
        container.register(DeleteLogsUseCase);
    }
});
