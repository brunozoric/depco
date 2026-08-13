import { createFeature } from "#shared/index.js";
import { GetDashboardHealthUseCase } from "./GetDashboardHealthUseCase.js";
import { GetDashboardScoreDetailUseCase } from "./GetDashboardScoreDetailUseCase.js";
import { GetDashboardActivityUseCase } from "./GetDashboardActivityUseCase.js";
import { GetDashboardStalenessUseCase } from "./GetDashboardStalenessUseCase.js";
import { GetDashboardSecurityUseCase } from "./GetDashboardSecurityUseCase.js";
import { GetDashboardDependencyChangesUseCase } from "./GetDashboardDependencyChangesUseCase.js";
import { GetDashboardTrendUseCase } from "./GetDashboardTrendUseCase.js";
import { GetDashboardVulnerabilityTrendUseCase } from "./GetDashboardVulnerabilityTrendUseCase.js";
import { GetDashboardStalenessTrendUseCase } from "./GetDashboardStalenessTrendUseCase.js";
import { GetDashboardLicenseTrendUseCase } from "./GetDashboardLicenseTrendUseCase.js";
import { GetDashboardAutoFixTrendUseCase } from "./GetDashboardAutoFixTrendUseCase.js";

export const DashboardUseCasesFeature = createFeature({
    name: "Api/DashboardUseCasesFeature",
    register(container) {
        container.register(GetDashboardHealthUseCase);
        container.register(GetDashboardScoreDetailUseCase);
        container.register(GetDashboardActivityUseCase);
        container.register(GetDashboardStalenessUseCase);
        container.register(GetDashboardSecurityUseCase);
        container.register(GetDashboardDependencyChangesUseCase);
        container.register(GetDashboardTrendUseCase);
        container.register(GetDashboardVulnerabilityTrendUseCase);
        container.register(GetDashboardStalenessTrendUseCase);
        container.register(GetDashboardLicenseTrendUseCase);
        container.register(GetDashboardAutoFixTrendUseCase);
    }
});
