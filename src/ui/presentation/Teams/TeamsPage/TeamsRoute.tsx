import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { TeamsProvider } from "./TeamsProvider.js";
import { TeamsPage } from "./components/TeamsPage.js";

class TeamsRouteImpl implements Abstraction.Interface {
    public name = "teams";
    public path = "/teams";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <TeamsProvider>{({ presenter }) => <TeamsPage presenter={presenter} />}</TeamsProvider>
        );
    }
}

export const TeamsRoute = Abstraction.createImplementation({
    implementation: TeamsRouteImpl,
    dependencies: []
});
