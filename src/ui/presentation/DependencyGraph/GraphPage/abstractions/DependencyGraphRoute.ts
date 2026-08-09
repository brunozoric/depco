import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const DependencyGraphRoute = createAbstraction<IRoute>("Ui/Route/DependencyGraph");

export namespace DependencyGraphRoute {
    export type Interface = IRoute;
}
