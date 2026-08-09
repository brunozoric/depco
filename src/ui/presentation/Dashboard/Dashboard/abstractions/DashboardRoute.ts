import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const DashboardRoute = createAbstraction<IRoute>("Ui/Route/Dashboard");

export namespace DashboardRoute {
    export type Interface = IRoute;
}
