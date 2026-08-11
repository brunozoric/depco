import { createFeature } from "#shared/index.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "./abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "./ProjectListPresenter.js";
import { CloneManagerFactory } from "./CloneManagerFactory.js";
import { DirectoryScanManagerFactory } from "./DirectoryScanManagerFactory.js";
import { ScanStatusManagerFactory } from "./ScanStatusManagerFactory.js";
import { ProjectsUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { FilesystemFeature } from "../../../features/Filesystem/feature.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";
import { ProjectListRoute } from "./ProjectListRoute.js";

export interface IProjectListFeatureExports {
    presenter: ProjectListPresenterAbstraction.Interface;
}

export const ProjectListFeature = createFeature<void, IProjectListFeatureExports>({
    name: "Ui/ProjectList",
    dependencies: [ProjectsUseCasesFeature, WebSocketFeature, FilesystemFeature, TeamFilterFeature],
    register(container) {
        container.register(CloneManagerFactory).inSingletonScope();
        container.register(DirectoryScanManagerFactory).inSingletonScope();
        container.register(ScanStatusManagerFactory).inSingletonScope();
        container.register(ProjectListPresenter);
        container.register(ProjectListRoute).inSingletonScope();
    },
    resolve(container) {
        return {
            presenter: container.resolve(ProjectListPresenterAbstraction)
        };
    }
});
