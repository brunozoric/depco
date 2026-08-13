import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { AuthService, UserService } from "#api/services/Auth/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { ForceLogoutUserUseCase } from "../abstractions/ForceLogoutUserUseCase.js";

function createStubAuthService(): AuthService.Interface {
    return {
        login: vi.fn(),
        verifyCode: vi.fn(),
        requestMagicLink: vi.fn(),
        verifyMagicLink: vi.fn(),
        getSessionUser: vi.fn(async () => null),
        logout: vi.fn(),
        forceLogout: vi.fn(async () => {}),
        cleanupExpired: vi.fn()
    };
}

function createStubBroadcaster(): WebSocketBroadcaster.Interface {
    return {
        broadcast: vi.fn(),
        addClient: vi.fn(),
        removeClient: vi.fn(),
        closeConnectionsForUser: vi.fn()
    };
}

async function setup() {
    const { container } = createTestApiContainer();
    const authService = createStubAuthService();
    const broadcaster = createStubBroadcaster();
    container.registerInstance(AuthService, authService);
    container.registerInstance(WebSocketBroadcaster, broadcaster);

    const userService = container.resolve(UserService);
    const targetUser = await userService.create({
        email: "target@example.com",
        displayName: "Target User",
        password: "password123",
        permission: "read-only"
    });

    return {
        useCase: container.resolve(ForceLogoutUserUseCase),
        authService,
        broadcaster,
        targetUser
    };
}

describe("ForceLogoutUserUseCase", () => {
    it("force-logs-out the user and closes their websocket connections", async () => {
        const { useCase, authService, broadcaster, targetUser } = await setup();

        const result = await useCase.execute({
            id: targetUser.id,
            sessionUserId: "acting-admin"
        });

        expect(result.isOk()).toBe(true);
        expect(authService.forceLogout).toHaveBeenCalledWith(targetUser.id);
        expect(broadcaster.closeConnectionsForUser).toHaveBeenCalledWith(targetUser.id);
    });

    it("fails with 400 when attempting to force-logout your own account", async () => {
        const { useCase, targetUser, authService } = await setup();

        const result = await useCase.execute({ id: targetUser.id, sessionUserId: targetUser.id });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(400);
        expect(authService.forceLogout).not.toHaveBeenCalled();
    });

    it("fails with 404 when the user does not exist", async () => {
        const { useCase } = await setup();

        const result = await useCase.execute({ id: "missing-user", sessionUserId: "acting-admin" });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });
});
