import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { ProjectListProvider } from "./ProjectListProvider.js";
import { ProjectListPage } from "./components/ProjectListPage.js";

class ProjectListRouteImpl implements Abstraction.Interface {
    public name = "project-list";
    public path = "/projects";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <ProjectListProvider>
                {({ presenter }) => <ProjectListPage presenter={presenter} />}
            </ProjectListProvider>
        );
    }
}

export const ProjectListRoute = Abstraction.createImplementation({
    implementation: ProjectListRouteImpl,
    dependencies: []
});
