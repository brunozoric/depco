import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const TrendsRoute = createAbstraction<IRoute>("Ui/Route/TrendsPage");

export namespace TrendsRoute {
    export type Interface = IRoute;
}
