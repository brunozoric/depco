import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { UsersGateway as UsersGatewayAbstraction } from "../../../../features/Users/abstractions/UsersGateway.js";
import { ForceLogoutUserUseCase } from "../abstractions/ForceLogoutUserUseCase.js";
import { ForceLogoutUserUseCase as ForceLogoutUserUseCaseRegistration } from "../ForceLogoutUserUseCase.js";

describe("ForceLogoutUserUseCase", () => {
    it("calls gateway.forceLogout with the id", async () => {
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
            remove: async () => {},
            forceLogout: async id => {
                receivedId = id;
            }
        });
        container.register(ForceLogoutUserUseCaseRegistration);

        const useCase = container.resolve(ForceLogoutUserUseCase);
        await useCase.execute("user-1");

        expect(receivedId).toBe("user-1");
    });
});
