import type React from "react";
import { UserListRoute as Abstraction } from "./abstractions/UserListRoute.js";
import type { IRouteMatch } from "../../../infrastructure/Router/abstractions/Route.js";
import { UserListProvider } from "./UserListProvider.js";
import { UserListPage } from "./components/UserListPage.js";

class UserListRouteImpl implements Abstraction.Interface {
    public name = "users";
    public path = "/users";

    public matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    public render(_match: IRouteMatch): React.ReactNode {
        return (
            <UserListProvider>
                {({ presenter }) => <UserListPage presenter={presenter} />}
            </UserListProvider>
        );
    }
}

export const UserListRoute = Abstraction.createImplementation({
    implementation: UserListRouteImpl,
    dependencies: []
});
