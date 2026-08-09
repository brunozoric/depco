import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const LogBrowserRoute = createAbstraction<IRoute>("Ui/Route/LogBrowser");

export namespace LogBrowserRoute {
    export type Interface = IRoute;
}
