import { createFeature } from "#shared/index.js";
import { AuditParserService } from "./AuditParserService.js";
import { OsvQueryService } from "./OsvQueryService.js";
import { VulnerabilityMerger } from "./VulnerabilityMerger.js";

export const SharedVulnerabilityFeature = createFeature({
    name: "Shared/Vulnerability",
    register(container) {
        container.register(AuditParserService).inSingletonScope();
        container.register(OsvQueryService).inSingletonScope();
        container.register(VulnerabilityMerger).inSingletonScope();
    }
});
