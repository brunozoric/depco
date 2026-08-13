import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { AuthService } from "#api/services/Auth/index.js";
import { LoginUseCase } from "../abstractions/LoginUseCase.js";

function createStubAuthService(
    overrides: Partial<AuthService.Interface> = {}
): AuthService.Interface {
    return {
        login: vi.fn(async () => {}),
        verifyCode: vi.fn(),
        requestMagicLink: vi.fn(),
        verifyMagicLink: vi.fn(),
        getSessionUser: vi.fn(async () => null),
        logout: vi.fn(),
        forceLogout: vi.fn(),
        cleanupExpired: vi.fn(),
        ...overrides
    };
}

function createUseCase(authService: AuthService.Interface): LoginUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(AuthService, authService);
    return container.resolve(LoginUseCase);
}

describe("LoginUseCase", () => {
    it("delegates to AuthService.login and returns ok on success", async () => {
        const authService = createStubAuthService();
        const useCase = createUseCase(authService);

        const result = await useCase.execute({
            email: "user@example.com",
            password: "password123"
        });

        expect(result.isOk()).toBe(true);
        expect(authService.login).toHaveBeenCalledWith({
            email: "user@example.com",
            password: "password123"
        });
    });

    it("maps a service error with statusCode/message onto the result", async () => {
        const authService = createStubAuthService({
            login: vi.fn(async () => {
                const error = new Error("Invalid email or password") as Error & {
                    statusCode?: number;
                };
                error.statusCode = 401;
                throw error;
            })
        });
        const useCase = createUseCase(authService);

        const result = await useCase.execute({ email: "user@example.com", password: "wrong" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(401);
        expect(result.error.message).toBe("Invalid email or password");
    });

    it("falls back to 500 and a default message for an unrecognized error shape", async () => {
        const authService = createStubAuthService({
            login: vi.fn(async () => {
                throw { statusCode: undefined, message: undefined };
            })
        });
        const useCase = createUseCase(authService);

        const result = await useCase.execute({ email: "user@example.com", password: "wrong" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(500);
        expect(result.error.message).toBe("Login failed");
    });
});
