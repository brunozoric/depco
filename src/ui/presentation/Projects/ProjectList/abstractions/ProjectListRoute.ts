import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const ProjectListRoute = createAbstraction<IRoute>("Ui/Route/ProjectList");

export namespace ProjectListRoute {
    export type Interface = IRoute;
}
