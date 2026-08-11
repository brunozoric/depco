import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { UpgradeWizardProvider } from "./UpgradeWizardProvider.js";
import { UpgradeWizardPage } from "./components/UpgradeWizardPage.js";

class UpgradeWizardRouteImpl implements Abstraction.Interface {
    public name = "upgrade-wizard";
    public path = /^\/projects\/([^/]+)\/upgrade$/;

    public matchPath(path: string): Record<string, string> | null {
        const match = (this.path as RegExp).exec(path);
        if (!match?.[1]) {
            return null;
        }
        return { projectId: match[1] };
    }

    public render(match: IRouteMatch): React.ReactNode {
        return (
            <UpgradeWizardProvider>
                {({ presenter }) => (
                    <UpgradeWizardPage
                        presenter={presenter}
                        projectId={match.params["projectId"]!}
                    />
                )}
            </UpgradeWizardProvider>
        );
    }
}

export const UpgradeWizardRoute = Abstraction.createImplementation({
    implementation: UpgradeWizardRouteImpl,
    dependencies: []
});
