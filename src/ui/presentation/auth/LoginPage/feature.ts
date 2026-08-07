import { createFeature } from "#shared/index.js";
import { LoginPresenter as LoginPresenterAbstraction } from "./abstractions/LoginPresenter.js";
import { LoginPresenter } from "./LoginPresenter.js";
import { AuthFeature } from "../../../features/auth/feature.js";

export interface ILoginPageFeatureExports {
    presenter: LoginPresenterAbstraction.Interface;
}

export const LoginPageFeature = createFeature<void, ILoginPageFeatureExports>({
    name: "Ui/LoginPage",
    dependencies: [AuthFeature],
    register(container) {
        container.register(LoginPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(LoginPresenterAbstraction)
        };
    }
});
