import { createFeature } from "#shared/index.js";
import { VulnerabilitiesFeature } from "../../../features/vulnerabilities/feature.js";
import { LoadVulnerabilitiesUseCase } from "./LoadVulnerabilitiesUseCase.js";
import { LoadVulnerabilitySummaryUseCase } from "./LoadVulnerabilitySummaryUseCase.js";
import { ScanVulnerabilitiesUseCase } from "./ScanVulnerabilitiesUseCase.js";
import { RefreshOsvCacheUseCase } from "./RefreshOsvCacheUseCase.js";
import { BulkVulnerabilityActionUseCase } from "./BulkVulnerabilityActionUseCase.js";
import { BulkRescanVulnerabilitiesUseCase } from "./BulkRescanVulnerabilitiesUseCase.js";
import { ExportVulnerabilitiesUseCase } from "./ExportVulnerabilitiesUseCase.js";
import { LoadVulnerabilityDetailUseCase } from "../VulnerabilityDetail/useCases/LoadVulnerabilityDetailUseCase.js";

export const VulnerabilitiesUseCasesFeature = createFeature({
    name: "Ui/VulnerabilitiesUseCases",
    dependencies: [VulnerabilitiesFeature],
    register(container) {
        container.register(LoadVulnerabilitiesUseCase);
        container.register(LoadVulnerabilitySummaryUseCase);
        container.register(ScanVulnerabilitiesUseCase);
        container.register(RefreshOsvCacheUseCase);
        container.register(BulkVulnerabilityActionUseCase);
        container.register(BulkRescanVulnerabilitiesUseCase);
        container.register(ExportVulnerabilitiesUseCase);
        container.register(LoadVulnerabilityDetailUseCase);
    }
});
