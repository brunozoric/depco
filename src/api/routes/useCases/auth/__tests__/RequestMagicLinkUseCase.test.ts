import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { AuthService } from "#api/services/Auth/index.js";
import { RequestMagicLinkUseCase } from "../abstractions/RequestMagicLinkUseCase.js";

function createStubAuthService(
    overrides: Partial<AuthService.Interface> = {}
): AuthService.Interface {
    return {
        login: vi.fn(),
        verifyCode: vi.fn(),
        requestMagicLink: vi.fn(async () => {}),
        verifyMagicLink: vi.fn(),
        getSessionUser: vi.fn(async () => null),
        logout: vi.fn(),
        forceLogout: vi.fn(),
        cleanupExpired: vi.fn(),
        ...overrides
    };
}

function createUseCase(authService: AuthService.Interface): RequestMagicLinkUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(AuthService, authService);
    return container.resolve(RequestMagicLinkUseCase);
}

describe("RequestMagicLinkUseCase", () => {
    it("delegates to AuthService.requestMagicLink and returns ok", async () => {
        const authService = createStubAuthService();
        const useCase = createUseCase(authService);

        const result = await useCase.execute({
            email: "user@example.com",
            baseUrl: "http://localhost:3000/login"
        });

        expect(result.isOk()).toBe(true);
        expect(authService.requestMagicLink).toHaveBeenCalledWith({
            email: "user@example.com",
            baseUrl: "http://localhost:3000/login"
        });
    });

    it("still returns ok when AuthService throws, to avoid user enumeration", async () => {
        const authService = createStubAuthService({
            requestMagicLink: vi.fn(async () => {
                throw new Error("Invalid email");
            })
        });
        const useCase = createUseCase(authService);

        const result = await useCase.execute({
            email: "nobody@example.com",
            baseUrl: "http://localhost:3000/login"
        });

        expect(result.isOk()).toBe(true);
    });
});
