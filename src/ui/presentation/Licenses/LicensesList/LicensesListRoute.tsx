import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { LicensesProvider } from "./LicensesProvider.js";
import { LicensesPage } from "./components/LicensesPage.js";

class LicensesListRouteImpl implements Abstraction.Interface {
    public name = "licenses";
    public path = "/licenses";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <LicensesProvider>
                {({ presenter }) => <LicensesPage presenter={presenter} />}
            </LicensesProvider>
        );
    }
}

export const LicensesListRoute = Abstraction.createImplementation({
    implementation: LicensesListRouteImpl,
    dependencies: []
});
