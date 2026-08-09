import { createFeature } from "#shared/index.js";

import { JobManagerPresentationFeature } from "./JobManager/feature.js";
import { JobManagerUseCasesFeature } from "./JobManager/useCases/feature.js";
import { JobProgressFeature } from "./JobProgress/feature.js";

export const JobsDomainFeature = createFeature({
    name: "Ui/Presentation/Jobs",
    dependencies: [JobManagerPresentationFeature, JobManagerUseCasesFeature, JobProgressFeature],
    register() {}
});
