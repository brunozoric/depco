import { createFeature } from "#shared/index.js";
import { GetChangelogsUseCase } from "./GetChangelogsUseCase.js";
import { ReResolveChangelogsUseCase } from "./ReResolveChangelogsUseCase.js";
import { ReResolveAllChangelogsUseCase } from "./ReResolveAllChangelogsUseCase.js";
import { GetChangelogStatsUseCase } from "./GetChangelogStatsUseCase.js";

export const ChangelogsUseCasesFeature = createFeature({
    name: "Api/ChangelogsUseCasesFeature",
    register(container) {
        container.register(GetChangelogsUseCase);
        container.register(ReResolveChangelogsUseCase);
        container.register(ReResolveAllChangelogsUseCase);
        container.register(GetChangelogStatsUseCase);
    }
});
