import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { PmSettingsProvider } from "./PmSettingsProvider.js";
import { PmSettingsPage } from "./components/PmSettingsPage.js";

class PmSettingsRouteImpl implements Abstraction.Interface {
    public name = "pm-settings";
    public path = "/settings";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <PmSettingsProvider>
                {({ presenter }) => <PmSettingsPage presenter={presenter} />}
            </PmSettingsProvider>
        );
    }
}

export const PmSettingsRoute = Abstraction.createImplementation({
    implementation: PmSettingsRouteImpl,
    dependencies: []
});
