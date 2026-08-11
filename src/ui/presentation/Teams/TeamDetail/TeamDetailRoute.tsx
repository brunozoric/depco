import type React from "react";
import { Route as Abstraction } from "../../../infrastructure/Router/abstractions/Route.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { TeamDetailProvider } from "./TeamDetailProvider.js";
import { TeamDetailPage } from "./components/TeamDetailPage.js";

class TeamDetailRouteImpl implements Abstraction.Interface {
    public name = "team-detail";
    public path = /^\/teams\/([^/]+)$/;

    public matchPath(path: string): Record<string, string> | null {
        const match = (this.path as RegExp).exec(path);
        if (!match?.[1]) {
            return null;
        }
        return { teamId: match[1] };
    }

    public render(match: IRouteMatch): React.ReactNode {
        return (
            <TeamDetailProvider>
                {({ presenter }) => (
                    <TeamDetailPage presenter={presenter} teamId={match.params["teamId"]!} />
                )}
            </TeamDetailProvider>
        );
    }
}

export const TeamDetailRoute = Abstraction.createImplementation({
    implementation: TeamDetailRouteImpl,
    dependencies: []
});
