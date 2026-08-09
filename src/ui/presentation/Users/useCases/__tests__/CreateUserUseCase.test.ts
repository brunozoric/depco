import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { UsersGateway as UsersGatewayAbstraction } from "../../../../features/Users/abstractions/UsersGateway.js";
import type { UsersGateway } from "../../../../features/Users/abstractions/UsersGateway.js";
import { CreateUserUseCase } from "../abstractions/CreateUserUseCase.js";
import { CreateUserUseCase as CreateUserUseCaseRegistration } from "../CreateUserUseCase.js";

describe("CreateUserUseCase", () => {
    it("calls gateway.create with the input and returns the created user", async () => {
        const container = createContainer();
        let receivedInput: UsersGateway.CreateInput | undefined;
        const created: UsersGateway.User = {
            id: "user-1",
            email: "new@example.com",
            displayName: "New User",
            permission: "read-only",
            isActive: true,
            createdAt: 1000,
            updatedAt: 1000
        };

        container.registerInstance(UsersGatewayAbstraction, {
            list: async () => ({ items: [], total: 0 }),
            getById: async () => created,
            create: async input => {
                receivedInput = input;
                return created;
            },
            update: async () => created,
            remove: async () => {},
            forceLogout: async () => {}
        });
        container.register(CreateUserUseCaseRegistration);

        const useCase = container.resolve(CreateUserUseCase);
        const result = await useCase.execute({
            email: "new@example.com",
            displayName: "New User",
            password: "supersecret",
            permission: "read-only"
        });

        expect(receivedInput).toEqual({
            email: "new@example.com",
            displayName: "New User",
            password: "supersecret",
            permission: "read-only"
        });
        expect(result).toEqual(created);
    });
});
