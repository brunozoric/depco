import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const TeamDetailRoute = createAbstraction<IRoute>("Ui/Route/TeamDetail");

export namespace TeamDetailRoute {
    export type Interface = IRoute;
}
