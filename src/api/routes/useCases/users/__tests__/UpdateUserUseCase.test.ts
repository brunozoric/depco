import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UserService } from "#api/services/Auth/index.js";
import { UpdateUserUseCase } from "../abstractions/UpdateUserUseCase.js";

async function setup() {
    const { container } = createTestApiContainer();
    const userService = container.resolve(UserService);
    const useCase = container.resolve(UpdateUserUseCase);

    const targetUser = await userService.create({
        email: "target@example.com",
        displayName: "Target User",
        password: "password123",
        permission: "read-only"
    });

    return { useCase, userService, targetUser };
}

describe("UpdateUserUseCase", () => {
    it("fails with 404 when the user does not exist", async () => {
        const { useCase } = await setup();

        const result = await useCase.execute({
            id: "missing-user",
            sessionUserId: "missing-user",
            sessionUserPermission: "full",
            displayName: "Anything"
        });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(404);
    });

    it("allows a self-service update to displayName", async () => {
        const { useCase, targetUser } = await setup();

        const result = await useCase.execute({
            id: targetUser.id,
            sessionUserId: targetUser.id,
            sessionUserPermission: "read-only",
            displayName: "Updated Name"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.displayName).toBe("Updated Name");
    });

    it("silently ignores permission/isActive changes on a self-service update", async () => {
        const { useCase, targetUser } = await setup();

        const result = await useCase.execute({
            id: targetUser.id,
            sessionUserId: targetUser.id,
            sessionUserPermission: "read-only",
            permission: "full",
            isActive: false
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.permission).toBe("read-only");
        expect(result.value.isActive).toBe(true);
    });

    it("fails with 403 when a non-full-permission user edits someone else's account", async () => {
        const { useCase, targetUser } = await setup();

        const result = await useCase.execute({
            id: targetUser.id,
            sessionUserId: "other-user",
            sessionUserPermission: "read-only",
            displayName: "Should not apply"
        });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(403);
    });

    it("allows a full-permission user to change another user's permission and isActive", async () => {
        const { useCase, targetUser } = await setup();

        const result = await useCase.execute({
            id: targetUser.id,
            sessionUserId: "admin-user",
            sessionUserPermission: "full",
            permission: "full",
            isActive: false
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.permission).toBe("full");
        expect(result.value.isActive).toBe(false);
    });

    it("updates the password when provided", async () => {
        const { useCase, userService, targetUser } = await setup();

        const result = await useCase.execute({
            id: targetUser.id,
            sessionUserId: targetUser.id,
            sessionUserPermission: "read-only",
            password: "new-password-123"
        });

        expect(result.isOk()).toBe(true);
        const verified = await userService.verifyPassword({
            userId: targetUser.id,
            password: "new-password-123"
        });
        expect(verified).toBe(true);
    });
});
