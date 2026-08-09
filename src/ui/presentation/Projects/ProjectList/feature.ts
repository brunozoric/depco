import { createFeature } from "#shared/index.js";
import { ProjectListPresenter as ProjectListPresenterAbstraction } from "./abstractions/ProjectListPresenter.js";
import { ProjectListPresenter } from "./ProjectListPresenter.js";
import { ProjectsUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { FilesystemFeature } from "../../../features/Filesystem/feature.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { ProjectListRoute as ProjectListRouteAbstraction } from "./abstractions/ProjectListRoute.js";
import { ProjectListRoute } from "./ProjectListRoute.js";

export interface IProjectListFeatureExports {
    presenter: ProjectListPresenterAbstraction.Interface;
}

export const ProjectListFeature = createFeature<void, IProjectListFeatureExports>({
    name: "Ui/ProjectList",
    dependencies: [
        RouterFeature,
        ProjectsUseCasesFeature,
        WebSocketFeature,
        FilesystemFeature,
        TeamFilterFeature
    ],
    register(container) {
        container.register(ProjectListPresenter);
        container.register(ProjectListRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(ProjectListRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(ProjectListPresenterAbstraction)
        };
    }
});
