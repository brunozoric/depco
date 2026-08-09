import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { UsersGateway as UsersGatewayAbstraction } from "../../../../features/Users/abstractions/UsersGateway.js";
import { DeleteUserUseCase } from "../abstractions/DeleteUserUseCase.js";
import { DeleteUserUseCase as DeleteUserUseCaseRegistration } from "../DeleteUserUseCase.js";

describe("DeleteUserUseCase", () => {
    it("calls gateway.remove with the id", async () => {
        const container = createContainer();
        let receivedId: string | undefined;

        container.registerInstance(UsersGatewayAbstraction, {
            list: async () => ({ items: [], total: 0 }),
            getById: async () => {
                throw new Error("not implemented");
            },
            create: async () => {
                throw new Error("not implemented");
            },
            update: async () => {
                throw new Error("not implemented");
            },
            remove: async id => {
                receivedId = id;
            },
            forceLogout: async () => {}
        });
        container.register(DeleteUserUseCaseRegistration);

        const useCase = container.resolve(DeleteUserUseCase);
        await useCase.execute("user-1");

        expect(receivedId).toBe("user-1");
    });
});
