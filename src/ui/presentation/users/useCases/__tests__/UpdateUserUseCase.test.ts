import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { UsersGateway as UsersGatewayAbstraction } from "../../../../features/users/abstractions/UsersGateway.js";
import type { UsersGateway } from "../../../../features/users/abstractions/UsersGateway.js";
import { UpdateUserUseCase } from "../abstractions/UpdateUserUseCase.js";
import { UpdateUserUseCase as UpdateUserUseCaseRegistration } from "../UpdateUserUseCase.js";

describe("UpdateUserUseCase", () => {
    it("calls gateway.update with the id and input and returns the updated user", async () => {
        const container = createContainer();
        let receivedArgs: { id: string; input: UsersGateway.UpdateInput } | undefined;
        const updated: UsersGateway.User = {
            id: "user-1",
            email: "jane@example.com",
            displayName: "Jane Updated",
            permission: "full",
            isActive: true,
            createdAt: 1000,
            updatedAt: 2000
        };

        container.registerInstance(UsersGatewayAbstraction, {
            list: async () => ({ items: [], total: 0 }),
            getById: async () => updated,
            create: async () => updated,
            update: async (id, input) => {
                receivedArgs = { id, input };
                return updated;
            },
            remove: async () => {},
            forceLogout: async () => {}
        });
        container.register(UpdateUserUseCaseRegistration);

        const useCase = container.resolve(UpdateUserUseCase);
        const result = await useCase.execute("user-1", {
            displayName: "Jane Updated",
            permission: "full"
        });

        expect(receivedArgs).toEqual({
            id: "user-1",
            input: { displayName: "Jane Updated", permission: "full" }
        });
        expect(result).toEqual(updated);
    });
});
