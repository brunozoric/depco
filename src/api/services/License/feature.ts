import { createFeature } from "#shared/index.js";
import { LicenseCheckerService } from "./LicenseCheckerService.js";
import { LicensePolicyService } from "./LicensePolicyService.js";

export const LicenseFeature = createFeature({
    name: "Api/LicenseFeature",
    register(container) {
        container.register(LicenseCheckerService).inSingletonScope();
        container.register(LicensePolicyService).inSingletonScope();
    }
});
