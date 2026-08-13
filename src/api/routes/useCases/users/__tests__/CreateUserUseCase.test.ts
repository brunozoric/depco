import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UserService } from "#api/services/Auth/index.js";
import { CreateUserUseCase } from "../abstractions/CreateUserUseCase.js";

describe("CreateUserUseCase", () => {
    it("creates a user and returns its response shape", async () => {
        const { container } = createTestApiContainer();
        const useCase = container.resolve(CreateUserUseCase);

        const result = await useCase.execute({
            email: "new.user@example.com",
            displayName: "New User",
            password: "password123",
            permission: "read-only"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value).toEqual({
            id: expect.any(String),
            email: "new.user@example.com",
            displayName: "New User",
            permission: "read-only",
            isActive: true,
            createdAt: expect.any(Number),
            updatedAt: expect.any(Number)
        });
    });

    it("fails with 500 when the UserService throws", async () => {
        const { container } = createTestApiContainer();
        container.registerInstance(UserService, {
            create: async () => {
                throw new Error("unique constraint failed");
            },
            getById: async () => null,
            getByEmail: async () => null,
            list: async () => ({ items: [], total: 0 }),
            update: async () => null,
            deactivate: async () => {},
            verifyPassword: async () => false,
            hasAnyUsers: async () => false
        });
        const useCase = container.resolve(CreateUserUseCase);

        const result = await useCase.execute({
            email: "dup@example.com",
            displayName: "Dup",
            password: "password123",
            permission: "full"
        });

        expect(result.isFail()).toBe(true);
        if (!result.isFail()) {
            return;
        }
        expect(result.error.statusCode).toBe(500);
        expect(result.error.message).toBe("unique constraint failed");
    });
});
