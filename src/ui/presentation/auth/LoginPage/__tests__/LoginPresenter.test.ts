import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { AuthGateway } from "../../../../features/auth/abstractions/AuthGateway.js";
import { AuthRepository } from "../../../../features/auth/abstractions/AuthRepository.js";
import { LoginPresenter } from "../abstractions/LoginPresenter.js";
import { LoginPresenter as LoginPresenterRegistration } from "../LoginPresenter.js";

const USER = {
    id: "u1",
    email: "user@example.com",
    displayName: "User",
    permission: "full" as const,
    isActive: true,
    createdAt: 1,
    updatedAt: 1
};

interface FakeAuthGatewayOptions {
    loginError?: Error;
    verifyCodeError?: Error;
    magicLinkError?: Error;
    verifyMagicLinkError?: Error;
}

function createFakeAuthGateway(options: FakeAuthGatewayOptions = {}): AuthGateway.Interface {
    return {
        login: vi.fn(async () => {
            if (options.loginError) {
                throw options.loginError;
            }
        }),
        verifyCode: vi.fn(async () => {
            if (options.verifyCodeError) {
                throw options.verifyCodeError;
            }
            return { token: "token-1", user: USER };
        }),
        requestMagicLink: vi.fn(async () => {
            if (options.magicLinkError) {
                throw options.magicLinkError;
            }
        }),
        verifyMagicLink: vi.fn(async () => {
            if (options.verifyMagicLinkError) {
                throw options.verifyMagicLinkError;
            }
            return { token: "magic-token-1", user: USER };
        }),
        logout: vi.fn(async () => {}),
        getMe: vi.fn(async () => USER)
    } as unknown as AuthGateway.Interface;
}

function createFakeAuthRepository(): AuthRepository.Interface {
    let token: string | null = null;
    let user: AuthRepository.User | null = null;

    return {
        get token() {
            return token;
        },
        get currentUser() {
            return user;
        },
        get isAuthenticated() {
            return token !== null;
        },
        setAuth: vi.fn((input: AuthRepository.SetAuthInput) => {
            token = input.token;
            user = input.user;
        }),
        clearAuth: vi.fn(() => {
            token = null;
            user = null;
        })
    };
}

describe("LoginPresenter", () => {
    let authGateway: AuthGateway.Interface;
    let authRepository: AuthRepository.Interface;

    function createPresenter(): LoginPresenter.Interface {
        const container = createContainer();
        container.registerInstance(AuthGateway, authGateway);
        container.registerInstance(AuthRepository, authRepository);
        container.register(LoginPresenterRegistration);
        return container.resolve(LoginPresenter);
    }

    beforeEach(() => {
        authGateway = createFakeAuthGateway();
        authRepository = createFakeAuthRepository();
    });

    it("starts in the idle state on the password tab", () => {
        const presenter = createPresenter();

        expect(presenter.vm.state).toBe("idle");
        expect(presenter.vm.activeTab).toBe("password");
        expect(presenter.vm.error).toBeNull();
    });

    it("setActiveTab() switches tabs and clears any error", () => {
        const presenter = createPresenter();
        presenter.setActiveTab("magic-link");

        expect(presenter.vm.activeTab).toBe("magic-link");
    });

    it("submitLogin() moves to credentials-submitted on success", async () => {
        const presenter = createPresenter();
        presenter.setEmail("user@example.com");
        presenter.setPassword("secret");

        await presenter.submitLogin();

        expect(authGateway.login).toHaveBeenCalledWith({
            email: "user@example.com",
            password: "secret"
        });
        expect(presenter.vm.state).toBe("credentials-submitted");
        expect(presenter.vm.error).toBeNull();
    });

    it("submitLogin() sets an error and stays idle on failure", async () => {
        authGateway = createFakeAuthGateway({ loginError: new Error("Invalid credentials") });
        const presenter = createPresenter();
        presenter.setEmail("user@example.com");
        presenter.setPassword("wrong");

        await presenter.submitLogin();

        expect(presenter.vm.state).toBe("idle");
        expect(presenter.vm.error).toBe("Invalid credentials");
    });

    it("submitCode() authenticates and stores auth on success", async () => {
        const presenter = createPresenter();
        presenter.setEmail("user@example.com");
        presenter.setCode("123456");

        await presenter.submitCode();

        expect(authGateway.verifyCode).toHaveBeenCalledWith({
            email: "user@example.com",
            code: "123456"
        });
        expect(authRepository.setAuth).toHaveBeenCalledWith({ token: "token-1", user: USER });
        expect(presenter.vm.state).toBe("authenticated");
    });

    it("submitCode() falls back to credentials-submitted with an error on failure", async () => {
        authGateway = createFakeAuthGateway({ verifyCodeError: new Error("Invalid code") });
        const presenter = createPresenter();
        presenter.setEmail("user@example.com");
        presenter.setCode("000000");

        await presenter.submitCode();

        expect(presenter.vm.state).toBe("credentials-submitted");
        expect(presenter.vm.error).toBe("Invalid code");
    });

    it("submitMagicLink() moves to magic-link-sent on success", async () => {
        const presenter = createPresenter();
        presenter.setEmail("user@example.com");

        await presenter.submitMagicLink();

        expect(authGateway.requestMagicLink).toHaveBeenCalledWith({ email: "user@example.com" });
        expect(presenter.vm.state).toBe("magic-link-sent");
    });

    it("verifyMagicLink() authenticates and stores auth on success", async () => {
        const presenter = createPresenter();

        await presenter.verifyMagicLink({ token: "magic-token", email: "user@example.com" });

        expect(authGateway.verifyMagicLink).toHaveBeenCalledWith({
            token: "magic-token",
            email: "user@example.com"
        });
        expect(authRepository.setAuth).toHaveBeenCalledWith({
            token: "magic-token-1",
            user: USER
        });
        expect(presenter.vm.state).toBe("authenticated");
    });

    it("verifyMagicLink() sets an error on failure", async () => {
        authGateway = createFakeAuthGateway({
            verifyMagicLinkError: new Error("Link expired")
        });
        const presenter = createPresenter();

        await presenter.verifyMagicLink({ token: "expired", email: "user@example.com" });

        expect(presenter.vm.error).toBe("Link expired");
        expect(presenter.vm.state).toBe("idle");
    });
});
