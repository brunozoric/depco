import type React from "react";
import { StepHooksRoute as Abstraction } from "./abstractions/StepHooksRoute.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { StepHooksProvider } from "./StepHooksProvider.js";
import { StepHooksPage } from "./components/StepHooksPage.js";

class StepHooksRouteImpl implements Abstraction.Interface {
    public name = "step-hooks";
    public path = /^\/projects\/([^/]+)\/step-hooks$/;

    public matchPath(path: string): Record<string, string> | null {
        const match = (this.path as RegExp).exec(path);
        if (!match?.[1]) {
            return null;
        }
        return { projectId: match[1] };
    }

    public render(match: IRouteMatch): React.ReactNode {
        return (
            <StepHooksProvider>
                {({ presenter }) => (
                    <StepHooksPage presenter={presenter} projectId={match.params["projectId"]!} />
                )}
            </StepHooksProvider>
        );
    }
}

export const StepHooksRoute = Abstraction.createImplementation({
    implementation: StepHooksRouteImpl,
    dependencies: []
});
