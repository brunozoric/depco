import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { PackageDetailProvider } from "./PackageDetailProvider.js";
import { PackageDetailPage } from "./components/PackageDetailPage.js";

class PackageDetailRouteImpl implements Abstraction.Interface {
    public name = "package-detail";
    public path = /^\/packages\/(.+)$/;

    public matchPath(path: string): Record<string, string> | null {
        const match = (this.path as RegExp).exec(path);
        if (!match?.[1]) {
            return null;
        }
        return { packageName: decodeURIComponent(match[1]) };
    }

    public render(match: IRouteMatch): React.ReactNode {
        return (
            <PackageDetailProvider>
                {({ presenter }) => (
                    <PackageDetailPage
                        presenter={presenter}
                        packageName={match.params["packageName"]!}
                    />
                )}
            </PackageDetailProvider>
        );
    }
}

export const PackageDetailRoute = Abstraction.createImplementation({
    implementation: PackageDetailRouteImpl,
    dependencies: []
});
