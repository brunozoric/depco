import { createFeature } from "#shared/index.js";
import { ProjectDetailPresenter as ProjectDetailPresenterAbstraction } from "./abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter } from "./ProjectDetailPresenter.js";
import { ProjectsUseCasesFeature } from "../useCases/feature.js";
import { UpgradesUseCasesFeature } from "../../upgrades/useCases/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";
import { ScanSchedulesUseCasesFeature } from "../../scanSchedules/useCases/feature.js";
import { VulnerabilitiesFeature } from "../../../features/vulnerabilities/feature.js";
import { LicensesFeature } from "../../../features/licenses/feature.js";
import { AutoFixFeature } from "../../../features/autoFix/feature.js";
import { SbomFeature } from "../../../features/sbom/feature.js";
import { TeamsFeature } from "../../../features/teams/feature.js";
import { TeamFilterFeature } from "../../../features/teamFilter/feature.js";

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
