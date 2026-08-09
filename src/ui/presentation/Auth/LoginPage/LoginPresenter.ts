import { computed, makeAutoObservable, runInAction } from "mobx";
import { LoginPresenter as Abstraction } from "./abstractions/LoginPresenter.js";
import { AuthGateway } from "../../../features/Auth/abstractions/AuthGateway.js";
import { AuthRepository } from "../../../features/Auth/abstractions/AuthRepository.js";

class LoginPresenterImpl implements Abstraction.Interface {
    private state: Abstraction.State = "idle";
    private emailValue = "";
    private passwordValue = "";
    private codeValue = "";
    private errorValue: string | null = null;
    private loading = false;
    private activeTabValue: Abstraction.Tab = "password";

    public constructor(
        private readonly authGateway: AuthGateway.Interface,
        private readonly authRepository: AuthRepository.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        return {
            state: this.state,
            email: this.emailValue,
            password: this.passwordValue,
            code: this.codeValue,
            error: this.errorValue,
            isLoading: this.loading,
            activeTab: this.activeTabValue
        };
    }

    public setEmail = (email: string): void => {
        this.emailValue = email;
    };

    public setPassword = (password: string): void => {
        this.passwordValue = password;
    };

    public setCode = (code: string): void => {
        this.codeValue = code;
    };

    public setActiveTab = (tab: Abstraction.Tab): void => {
        this.activeTabValue = tab;
        this.errorValue = null;
    };

    public submitLogin = async (): Promise<void> => {
        this.loading = true;
        this.errorValue = null;
        try {
            await this.authGateway.login({
                email: this.emailValue,
                password: this.passwordValue
            });
            runInAction(() => {
                this.state = "credentials-submitted";
            });
        } catch (error) {
            runInAction(() => {
                this.errorValue = error instanceof Error ? error.message : "Login failed";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public submitCode = async (): Promise<void> => {
        this.state = "verifying-code";
        this.loading = true;
        this.errorValue = null;
        try {
            const result = await this.authGateway.verifyCode({
                email: this.emailValue,
                code: this.codeValue
            });
            runInAction(() => {
                this.authRepository.setAuth({ token: result.token, user: result.user });
                this.state = "authenticated";
            });
        } catch (error) {
            runInAction(() => {
                this.errorValue = error instanceof Error ? error.message : "Verification failed";
                this.state = "credentials-submitted";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public submitMagicLink = async (): Promise<void> => {
        this.loading = true;
        this.errorValue = null;
        try {
            await this.authGateway.requestMagicLink({ email: this.emailValue });
            runInAction(() => {
                this.state = "magic-link-sent";
            });
        } catch (error) {
            runInAction(() => {
                this.errorValue =
                    error instanceof Error ? error.message : "Failed to send magic link";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public verifyMagicLink = async (input: Abstraction.VerifyMagicLinkInput): Promise<void> => {
        this.loading = true;
        this.errorValue = null;
        try {
            const result = await this.authGateway.verifyMagicLink(input);
            runInAction(() => {
                this.authRepository.setAuth({ token: result.token, user: result.user });
                this.state = "authenticated";
            });
        } catch (error) {
            runInAction(() => {
                this.errorValue =
                    error instanceof Error ? error.message : "Magic link verification failed";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };
}

export const LoginPresenter = Abstraction.createImplementation({
    implementation: LoginPresenterImpl,
    dependencies: [AuthGateway, AuthRepository]
});
