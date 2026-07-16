import { createFeature } from "#shared/index.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "./abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "./ProjectListPresenter.js";
import { ProjectsUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";
import { FilesystemFeature } from "../../../features/filesystem/feature.js";
import { TeamFilterFeature } from "../../../features/teamFilter/feature.js";

export interface IProjectListFeatureExports {
    presenter: ProjectListPresenterAbstraction.Interface;
}

export const ProjectListFeature = createFeature<void, IProjectListFeatureExports>({
    name: "Ui/ProjectList",
    dependencies: [ProjectsUseCasesFeature, WebSocketFeature, FilesystemFeature, TeamFilterFeature],
    register(container) {
        container.register(ProjectListPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(ProjectListPresenterAbstraction)
        };
    }
});
