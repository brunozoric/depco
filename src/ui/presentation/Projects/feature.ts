import { createFeature } from "#shared/index.js";

import { ProjectDetailFeature } from "./ProjectDetail/feature.js";
import { ProjectListFeature } from "./ProjectList/feature.js";
import { StepHooksPresentationFeature } from "./StepHooks/feature.js";
import { UpgradeWizardFeature } from "./UpgradeWizard/feature.js";
import { ProjectsUseCasesFeature } from "./useCases/feature.js";

export const ProjectsDomainFeature = createFeature({
    name: "Ui/Presentation/Projects",
    dependencies: [
        UpgradeWizardFeature,
        StepHooksPresentationFeature,
        ProjectDetailFeature,
        ProjectListFeature,
        ProjectsUseCasesFeature
    ],
    register() {}
});
