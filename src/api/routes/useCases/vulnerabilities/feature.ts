import { createFeature } from "#shared/index.js";
import { ListVulnerabilitiesUseCase } from "./ListVulnerabilitiesUseCase.js";
import { GetVulnerabilitySummaryUseCase } from "./GetVulnerabilitySummaryUseCase.js";
import { ExportVulnerabilitiesUseCase } from "./ExportVulnerabilitiesUseCase.js";
import { GetVulnerabilityDetailUseCase } from "./GetVulnerabilityDetailUseCase.js";
import { GetExpiredSnoozesUseCase } from "./GetExpiredSnoozesUseCase.js";
import { GetProjectVulnerabilitiesUseCase } from "./GetProjectVulnerabilitiesUseCase.js";
import { RefreshOsvCacheUseCase } from "./RefreshOsvCacheUseCase.js";
import { BulkVulnerabilityActionUseCase } from "./BulkVulnerabilityActionUseCase.js";
import { BulkRescanVulnerabilitiesUseCase } from "./BulkRescanVulnerabilitiesUseCase.js";
import { ScanVulnerabilitiesUseCase } from "./ScanVulnerabilitiesUseCase.js";

export const VulnerabilitiesUseCasesFeature = createFeature({
    name: "Api/VulnerabilitiesUseCasesFeature",
    register(container) {
        container.register(ListVulnerabilitiesUseCase);
        container.register(GetVulnerabilitySummaryUseCase);
        container.register(ExportVulnerabilitiesUseCase);
        container.register(GetVulnerabilityDetailUseCase);
        container.register(GetExpiredSnoozesUseCase);
        container.register(GetProjectVulnerabilitiesUseCase);
        container.register(RefreshOsvCacheUseCase);
        container.register(BulkVulnerabilityActionUseCase);
        container.register(BulkRescanVulnerabilitiesUseCase);
        container.register(ScanVulnerabilitiesUseCase);
    }
});
