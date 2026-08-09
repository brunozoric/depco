import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const PackagesRoute = createAbstraction<IRoute>("Ui/Route/PackageList");

export namespace PackagesRoute {
    export type Interface = IRoute;
}
