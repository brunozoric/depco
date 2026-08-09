import { createFeature } from "#shared/index.js";
import { UserListPresenter as UserListPresenterAbstraction } from "./abstractions/UserListPresenter.js";
import { UserListPresenter } from "./UserListPresenter.js";
import { UsersUseCasesFeature } from "../useCases/feature.js";
import { UsersFeature } from "../../../features/Users/feature.js";
import { AuthFeature } from "../../../features/Auth/feature.js";
import { UrlFilterFeature } from "../../../features/UrlFilter/feature.js";

export interface IUserListFeatureExports {
    presenter: UserListPresenterAbstraction.Interface;
}

export const UserListFeature = createFeature<void, IUserListFeatureExports>({
    name: "Ui/UserList",
    dependencies: [UsersUseCasesFeature, UsersFeature, AuthFeature, UrlFilterFeature],
    register(container) {
        container.register(UserListPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(UserListPresenterAbstraction)
        };
    }
});
