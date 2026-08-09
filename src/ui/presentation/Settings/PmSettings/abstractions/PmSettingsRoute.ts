import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const PmSettingsRoute = createAbstraction<IRoute>("Ui/Route/PmSettings");

export namespace PmSettingsRoute {
    export type Interface = IRoute;
}
