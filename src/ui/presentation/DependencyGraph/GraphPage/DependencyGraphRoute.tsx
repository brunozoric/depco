import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { DependencyGraphProvider } from "./DependencyGraphProvider.js";
import { DependencyGraphPage } from "./components/DependencyGraphPage.js";

class DependencyGraphRouteImpl implements Abstraction.Interface {
    public name = "dependency-graph";
    public path = /^\/projects\/([^/]+)\/graph$/;

    public matchPath(path: string): Record<string, string> | null {
        const match = (this.path as RegExp).exec(path);
        if (!match?.[1]) {
            return null;
        }
        return { projectId: match[1] };
    }

    public render(match: IRouteMatch): React.ReactNode {
        return (
            <DependencyGraphProvider>
                {({ presenter }) => (
                    <DependencyGraphPage
                        presenter={presenter}
                        projectId={match.params["projectId"]!}
                    />
                )}
            </DependencyGraphProvider>
        );
    }
}

export const DependencyGraphRoute = Abstraction.createImplementation({
    implementation: DependencyGraphRouteImpl,
    dependencies: []
});
