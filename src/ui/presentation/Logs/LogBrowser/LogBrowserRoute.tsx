import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { LogBrowserProvider } from "./LogBrowserProvider.js";
import { LogBrowserPage } from "./components/LogBrowserPage.js";

class LogBrowserRouteImpl implements Abstraction.Interface {
    public name = "log-browser";
    public path = "/logs";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <LogBrowserProvider>
                {({ presenter }) => <LogBrowserPage presenter={presenter} />}
            </LogBrowserProvider>
        );
    }
}

export const LogBrowserRoute = Abstraction.createImplementation({
    implementation: LogBrowserRouteImpl,
    dependencies: []
});
