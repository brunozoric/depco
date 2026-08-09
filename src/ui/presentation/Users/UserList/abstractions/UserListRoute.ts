import { createAbstraction } from "#shared/index.js";
import type { IRoute } from "../../../../infrastructure/Router/abstractions/Route.js";

export const UserListRoute = createAbstraction<IRoute>("Ui/Route/UserList");

export namespace UserListRoute {
    export type Interface = IRoute;
}
