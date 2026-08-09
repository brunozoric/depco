import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const ProjectDetailRoute = createAbstraction<IRoute>("Ui/Route/ProjectDetail");

export namespace ProjectDetailRoute {
    export type Interface = IRoute;
}
