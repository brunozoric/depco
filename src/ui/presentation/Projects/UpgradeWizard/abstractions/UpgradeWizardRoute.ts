import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const UpgradeWizardRoute = createAbstraction<IRoute>("Ui/Route/UpgradeWizard");

export namespace UpgradeWizardRoute {
    export type Interface = IRoute;
}
