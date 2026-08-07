import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { listUsersRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { UsersGateway as UsersGatewayRegistration } from "../../../../features/users/UsersGateway.js";
import { UsersRepository } from "../../../../features/users/abstractions/UsersRepository.js";
import { UsersRepository as UsersRepositoryRegistration } from "../../../../features/users/UsersRepository.js";
import { LoadUsersUseCase } from "../abstractions/LoadUsersUseCase.js";
import { LoadUsersUseCase as LoadUsersUseCaseRegistration } from "../LoadUsersUseCase.js";
import type { UserResponse } from "#shared/users/index.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    usersRepository: UsersRepository.Interface;
    loadUsersUseCase: LoadUsersUseCase.Interface;
}

const exampleUser: UserResponse = {
    id: "user-1",
    email: "jane@example.com",
    displayName: "Jane Doe",
    permission: "read-only",
    isActive: true,
    createdAt: 1000,
    updatedAt: 1000
};

describe("LoadUsersUseCase", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(UsersGatewayRegistration).inSingletonScope();
        container.register(UsersRepositoryRegistration).inSingletonScope();
        container.register(LoadUsersUseCaseRegistration);

        return {
            usersRepository: container.resolve(UsersRepository),
            loadUsersUseCase: container.resolve(LoadUsersUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("calls the gateway and stores the results in the repository", async () => {
        const context = createContext();
        mockResult = { items: [exampleUser], total: 1 };

        await context.loadUsersUseCase.execute();

        expect(calls).toEqual([
            {
                route: listUsersRoute,
                args: {
                    params: {},
                    query: { page: 1, pageSize: 25, sortBy: "createdAt", sortOrder: "desc" }
                }
            }
        ]);
        expect(context.usersRepository.getUsers()).toEqual([exampleUser]);
        expect(context.usersRepository.getTotal()).toBe(1);
    });

    it("passes an explicit query through to the gateway", async () => {
        const context = createContext();
        mockResult = { items: [], total: 0 };

        await context.loadUsersUseCase.execute({ search: "jane", page: 2, pageSize: 10 });

        expect(calls).toEqual([
            {
                route: listUsersRoute,
                args: {
                    params: {},
                    query: {
                        search: "jane",
                        page: 2,
                        pageSize: 10,
                        sortBy: "createdAt",
                        sortOrder: "desc"
                    }
                }
            }
        ]);
        expect(context.usersRepository.getUsers()).toEqual([]);
        expect(context.usersRepository.getTotal()).toBe(0);
    });
});
