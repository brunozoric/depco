import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const LicensesListRoute = createAbstraction<IRoute>("Ui/Route/LicensesList");

export namespace LicensesListRoute {
    export type Interface = IRoute;
}
