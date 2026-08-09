import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const JobManagerRoute = createAbstraction<IRoute>("Ui/Route/JobManager");

export namespace JobManagerRoute {
    export type Interface = IRoute;
}
