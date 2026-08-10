import { createFeature } from "#shared/index.js";
import { SharedVulnerabilityFeature } from "#shared/vulnerabilities/feature.js";
import { CheckVulnerabilitiesStep } from "./CheckVulnerabilitiesStep.js";

export const CheckVulnerabilitiesStepFeature = createFeature({
    name: "Cli/CheckVulnerabilitiesStep",
    dependencies: [SharedVulnerabilityFeature],
    register(container) {
        container.register(CheckVulnerabilitiesStep).inSingletonScope();
    }
});
