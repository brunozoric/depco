import { createFeature } from "#shared/index.js";
import { ProjectDetailPresenter as ProjectDetailPresenterAbstraction } from "./abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter } from "./ProjectDetailPresenter.js";
import { ProjectsUseCasesFeature } from "../useCases/feature.js";
import { UpgradesUseCasesFeature } from "../../upgrades/useCases/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";
import { ScanSchedulesUseCasesFeature } from "../../scanSchedules/useCases/feature.js";
import { VulnerabilitiesFeature } from "../../../features/Vulnerabilities/feature.js";
import { LicensesFeature } from "../../../features/Licenses/feature.js";
import { AutoFixFeature } from "../../../features/AutoFix/feature.js";
import { SbomFeature } from "../../../features/Sbom/feature.js";
import { TeamsFeature } from "../../../features/Teams/feature.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";

export interface IProjectDetailFeatureExports {
    presenter: ProjectDetailPresenterAbstraction.Interface;
}

export const ProjectDetailFeature = createFeature<void, IProjectDetailFeatureExports>({
    name: "Ui/ProjectDetail",
    dependencies: [
        ProjectsUseCasesFeature,
        UpgradesUseCasesFeature,
        WebSocketFeature,
        ScanSchedulesUseCasesFeature,
        VulnerabilitiesFeature,
        LicensesFeature,
        AutoFixFeature,
        SbomFeature,
        TeamsFeature,
        TeamFilterFeature
    ],
    register(container) {
        container.register(ProjectDetailPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(ProjectDetailPresenterAbstraction)
        };
    }
});
