import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { DashboardProvider } from "./DashboardProvider.js";
import { DashboardPage } from "./components/DashboardPage.js";

class DashboardRouteImpl implements Abstraction.Interface {
    public name = "dashboard";
    public path = "/";

    public matchPath(_path: string): Record<string, string> | null {
        return {};
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <DashboardProvider>
                {({ presenter }) => <DashboardPage presenter={presenter} />}
            </DashboardProvider>
        );
    }
}

export const DashboardRoute = Abstraction.createImplementation({
    implementation: DashboardRouteImpl,
    dependencies: []
});
