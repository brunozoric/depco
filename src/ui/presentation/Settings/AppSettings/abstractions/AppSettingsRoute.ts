import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const AppSettingsRoute = createAbstraction<IRoute>("Ui/Route/AppSettings");

export namespace AppSettingsRoute {
    export type Interface = IRoute;
}
