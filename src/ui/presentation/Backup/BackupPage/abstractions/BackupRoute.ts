import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const BackupRoute = createAbstraction<IRoute>("Ui/Route/Backup");

export namespace BackupRoute {
    export type Interface = IRoute;
}
