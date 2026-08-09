import type React from "react";
import { JobManagerRoute as Abstraction } from "./abstractions/JobManagerRoute.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { JobManagerProvider } from "./JobManagerProvider.js";
import { JobManagerPage } from "./components/JobManagerPage.js";

class JobManagerRouteImpl implements Abstraction.Interface {
    public name = "job-manager";
    public path = "/jobs";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <JobManagerProvider>
                {({ presenter }) => <JobManagerPage presenter={presenter} />}
            </JobManagerProvider>
        );
    }
}

export const JobManagerRoute = Abstraction.createImplementation({
    implementation: JobManagerRouteImpl,
    dependencies: []
});
