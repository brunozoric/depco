import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const StepHooksRoute = createAbstraction<IRoute>("Ui/Route/StepHooks");

export namespace StepHooksRoute {
    export type Interface = IRoute;
}
