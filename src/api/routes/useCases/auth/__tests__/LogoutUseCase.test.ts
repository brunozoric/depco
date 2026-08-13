import { createHash } from "crypto";
import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { AuthService } from "#api/services/Auth/index.js";
import { LogoutUseCase } from "../abstractions/LogoutUseCase.js";

function createStubAuthService(
    overrides: Partial<AuthService.Interface> = {}
): AuthService.Interface {
    return {
        login: vi.fn(),
        verifyCode: vi.fn(),
        requestMagicLink: vi.fn(),
        verifyMagicLink: vi.fn(),
        getSessionUser: vi.fn(async () => null),
        logout: vi.fn(async () => {}),
        forceLogout: vi.fn(),
        cleanupExpired: vi.fn(),
        ...overrides
    };
}

function createUseCase(authService: AuthService.Interface): LogoutUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(AuthService, authService);
    return container.resolve(LogoutUseCase);
}

describe("LogoutUseCase", () => {
    it("hashes the bearer token and logs out the matching session", async () => {
        const authService = createStubAuthService();
        const useCase = createUseCase(authService);
        const token = "raw-session-token";
        const expectedHash = createHash("sha256").update(token).digest("hex");

        const result = await useCase.execute({ authorizationHeader: `Bearer ${token}` });

        expect(result.isOk()).toBe(true);
        expect(authService.logout).toHaveBeenCalledWith(expectedHash);
    });

    it("does nothing when there is no authorization header", async () => {
        const authService = createStubAuthService();
        const useCase = createUseCase(authService);

        const result = await useCase.execute({ authorizationHeader: undefined });

        expect(result.isOk()).toBe(true);
        expect(authService.logout).not.toHaveBeenCalled();
    });

    it("does nothing when the header is not a Bearer token", async () => {
        const authService = createStubAuthService();
        const useCase = createUseCase(authService);

        const result = await useCase.execute({ authorizationHeader: "Basic dXNlcjpwYXNz" });

        expect(result.isOk()).toBe(true);
        expect(authService.logout).not.toHaveBeenCalled();
    });
});
