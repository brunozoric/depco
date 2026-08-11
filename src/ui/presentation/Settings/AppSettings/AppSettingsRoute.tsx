import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { AppSettingsProvider } from "./AppSettingsProvider.js";
import { AppSettingsPage } from "./components/AppSettingsPage.js";

class AppSettingsRouteImpl implements Abstraction.Interface {
    public name = "app-settings";
    public path = "/settings/app";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <AppSettingsProvider>
                {({ presenter }) => <AppSettingsPage presenter={presenter} />}
            </AppSettingsProvider>
        );
    }
}

export const AppSettingsRoute = Abstraction.createImplementation({
    implementation: AppSettingsRouteImpl,
    dependencies: []
});
