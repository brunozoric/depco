import { createFeature } from "#shared/index.js";
import { UserListPresenter as UserListPresenterAbstraction } from "./abstractions/UserListPresenter.js";
import { UserListPresenter } from "./UserListPresenter.js";
import { UsersUseCasesFeature } from "../useCases/feature.js";
import { UsersFeature } from "../../../features/Users/feature.js";
import { AuthFeature } from "../../../features/Auth/feature.js";
import { UrlFilterFeature } from "../../../features/UrlFilter/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { UserListRoute as UserListRouteAbstraction } from "./abstractions/UserListRoute.js";
import { UserListRoute } from "./UserListRoute.js";

export interface IUserListFeatureExports {
    presenter: UserListPresenterAbstraction.Interface;
}

export const UserListFeature = createFeature<void, IUserListFeatureExports>({
    name: "Ui/UserList",
    dependencies: [
        RouterFeature,
        UsersUseCasesFeature,
        UsersFeature,
        AuthFeature,
        UrlFilterFeature
    ],
    register(container) {
        container.register(UserListPresenter);
        container.register(UserListRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(UserListRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(UserListPresenterAbstraction)
        };
    }
});
