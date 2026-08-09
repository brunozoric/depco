import type React from "react";
import { PackagesRoute as Abstraction } from "./abstractions/PackagesRoute.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { PackagesProvider } from "./PackagesProvider.js";
import { PackagesPage } from "./components/PackagesPage.js";

class PackagesRouteImpl implements Abstraction.Interface {
    public name = "packages";
    public path = "/packages";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <PackagesProvider>
                {({ presenter }) => <PackagesPage presenter={presenter} />}
            </PackagesProvider>
        );
    }
}

export const PackagesRoute = Abstraction.createImplementation({
    implementation: PackagesRouteImpl,
    dependencies: []
});
