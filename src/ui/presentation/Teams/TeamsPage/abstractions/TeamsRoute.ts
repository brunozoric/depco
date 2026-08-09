import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const TeamsRoute = createAbstraction<IRoute>("Ui/Route/TeamsPage");

export namespace TeamsRoute {
    export type Interface = IRoute;
}
