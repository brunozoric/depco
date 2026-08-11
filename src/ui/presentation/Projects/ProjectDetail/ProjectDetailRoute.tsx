import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { ProjectDetailProvider } from "./ProjectDetailProvider.js";
import { ProjectDetailPage } from "./components/ProjectDetailPage.js";

class ProjectDetailRouteImpl implements Abstraction.Interface {
    public name = "project-detail";
    public path = /^\/projects\/([^/]+)$/;

    public matchPath(path: string): Record<string, string> | null {
        const match = (this.path as RegExp).exec(path);
        if (!match?.[1]) {
            return null;
        }
        return { projectId: match[1] };
    }

    public render(match: IRouteMatch): React.ReactNode {
        return (
            <ProjectDetailProvider>
                {({ presenter }) => (
                    <ProjectDetailPage
                        presenter={presenter}
                        projectId={match.params["projectId"]!}
                    />
                )}
            </ProjectDetailProvider>
        );
    }
}

export const ProjectDetailRoute = Abstraction.createImplementation({
    implementation: ProjectDetailRouteImpl,
    dependencies: []
});
