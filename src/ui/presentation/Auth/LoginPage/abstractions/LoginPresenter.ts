import { createAbstraction } from "#shared/index.js";

export const LOGIN_STATES = [
    "idle",
    "credentials-submitted",
    "verifying-code",
    "authenticated",
    "magic-link-sent"
] as const;

export type ILoginState = (typeof LOGIN_STATES)[number];

export const LOGIN_TABS = ["password", "magic-link"] as const;

export type ILoginTab = (typeof LOGIN_TABS)[number];

export interface IVerifyMagicLinkInput {
    token: string;
    email: string;
}

export interface ILoginViewModel {
    state: ILoginState;
    email: string;
    password: string;
    code: string;
    error: string | null;
    isLoading: boolean;
    activeTab: ILoginTab;
}

export interface ILoginPresenter {
    get vm(): ILoginViewModel;
    setEmail(email: string): void;
    setPassword(password: string): void;
    setCode(code: string): void;
    setActiveTab(tab: ILoginTab): void;
    submitLogin(): Promise<void>;
    submitCode(): Promise<void>;
    submitMagicLink(): Promise<void>;
    verifyMagicLink(input: IVerifyMagicLinkInput): Promise<void>;
}

export const LoginPresenter = createAbstraction<ILoginPresenter>("Ui/LoginPresenter");

export namespace LoginPresenter {
    export type Interface = ILoginPresenter;
    export type ViewModel = ILoginViewModel;
    export type State = ILoginState;
    export type Tab = ILoginTab;
    export type VerifyMagicLinkInput = IVerifyMagicLinkInput;
}
