import type React from "react";
import { TrendsRoute as Abstraction } from "./abstractions/TrendsRoute.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { TrendsProvider } from "./TrendsProvider.js";
import { TrendsPage } from "./components/TrendsPage.js";

class TrendsRouteImpl implements Abstraction.Interface {
    public name = "trends";
    public path = "/trends";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <TrendsProvider>
                {({ presenter }) => <TrendsPage presenter={presenter} />}
            </TrendsProvider>
        );
    }
}

export const TrendsRoute = Abstraction.createImplementation({
    implementation: TrendsRouteImpl,
    dependencies: []
});
