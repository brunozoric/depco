import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { BackupProvider } from "./BackupProvider.js";
import { BackupPage } from "./components/BackupPage.js";

class BackupRouteImpl implements Abstraction.Interface {
    public name = "backup";
    public path = "/backup";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <BackupProvider>
                {({ presenter }) => <BackupPage presenter={presenter} />}
            </BackupProvider>
        );
    }
}

export const BackupRoute = Abstraction.createImplementation({
    implementation: BackupRouteImpl,
    dependencies: []
});
