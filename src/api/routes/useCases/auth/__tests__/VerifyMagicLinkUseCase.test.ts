import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { AuthService } from "#api/services/Auth/index.js";
import { VerifyMagicLinkUseCase } from "../abstractions/VerifyMagicLinkUseCase.js";

function createStubAuthService(
    overrides: Partial<AuthService.Interface> = {}
): AuthService.Interface {
    return {
        login: vi.fn(),
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

function createUseCase(authService: AuthService.Interface): VerifyMagicLinkUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(AuthService, authService);
    return container.resolve(VerifyMagicLinkUseCase);
}

describe("VerifyMagicLinkUseCase", () => {
    it("returns the token and user for a valid link", async () => {
        const verifyResult = {
            token: "session-token",
            user: {
                id: "user-1",
                email: "user@example.com",
                displayName: "User",
                permission: "read-only" as const,
                isActive: true,
                createdAt: 1,
                updatedAt: 1
            }
        };
        const authService = createStubAuthService({
            verifyMagicLink: vi.fn(async () => verifyResult)
        });
        const useCase = createUseCase(authService);

        const result = await useCase.execute({ token: "magic-token", email: "user@example.com" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual(verifyResult);
        expect(authService.verifyMagicLink).toHaveBeenCalledWith({
            token: "magic-token",
            email: "user@example.com"
        });
    });

    it("maps a service error onto the result", async () => {
        const authService = createStubAuthService({
            verifyMagicLink: vi.fn(async () => {
                const error = new Error("Invalid or expired link") as Error & {
                    statusCode?: number;
                };
                error.statusCode = 400;
                throw error;
            })
        });
        const useCase = createUseCase(authService);

        const result = await useCase.execute({ token: "bogus", email: "user@example.com" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
        expect(result.error.message).toBe("Invalid or expired link");
    });

    it("falls back to 500 and a default message for an unrecognized error shape", async () => {
        const authService = createStubAuthService({
            verifyMagicLink: vi.fn(async () => {
                throw { statusCode: undefined, message: undefined };
            })
        });
        const useCase = createUseCase(authService);

        const result = await useCase.execute({ token: "bogus", email: "user@example.com" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(500);
        expect(result.error.message).toBe("Verification failed");
    });
});
