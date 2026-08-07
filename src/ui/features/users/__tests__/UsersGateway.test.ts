import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    listUsersRoute,
    getUserRoute,
    createUserRoute,
    updateUserRoute,
    deleteUserRoute,
    forceLogoutUserRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { UsersGateway } from "../abstractions/UsersGateway.js";
import { UsersGateway as UsersGatewayRegistration } from "../UsersGateway.js";
import type { UserResponse } from "#shared/users/index.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

function user(overrides: Partial<UserResponse> = {}): UserResponse {
    return {
        id: "user-1",
        email: "jane@example.com",
        displayName: "Jane Doe",
        permission: "read-only",
        isActive: true,
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides
    };
}

describe("UsersGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): UsersGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(UsersGatewayRegistration);

        return container.resolve(UsersGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("list() with no query applies default pagination and sort", async () => {
        const gateway = createGateway();
        mockResult = { items: [user()], total: 1 };

        const result = await gateway.list();

        expect(calls).toEqual([
            {
                route: listUsersRoute,
                args: {
                    params: {},
                    query: { page: 1, pageSize: 25, sortBy: "createdAt", sortOrder: "desc" }
                }
            }
        ]);
        expect(result).toEqual({ items: [user()], total: 1 });
    });

    it("list() forwards search, isActive, and explicit pagination/sort", async () => {
        const gateway = createGateway();
        mockResult = { items: [], total: 0 };

        await gateway.list({
            search: "jane",
            isActive: true,
            page: 2,
            pageSize: 10,
            sortBy: "email",
            sortOrder: "asc"
        });

        expect(calls).toEqual([
            {
                route: listUsersRoute,
                args: {
                    params: {},
                    query: {
                        search: "jane",
                        isActive: true,
                        page: 2,
                        pageSize: 10,
                        sortBy: "email",
                        sortOrder: "asc"
                    }
                }
            }
        ]);
    });

    it("getById() calls getUserRoute and returns the item", async () => {
        const gateway = createGateway();
        mockResult = { item: user() };

        const result = await gateway.getById("user-1");

        expect(calls).toEqual([{ route: getUserRoute, args: { params: { id: "user-1" } } }]);
        expect(result).toEqual(user());
    });

    it("create() calls createUserRoute with the body and returns the item", async () => {
        const gateway = createGateway();
        mockResult = { item: user({ email: "new@example.com" }) };

        const result = await gateway.create({
            email: "new@example.com",
            displayName: "New User",
            password: "supersecret",
            permission: "full"
        });

        expect(calls).toEqual([
            {
                route: createUserRoute,
                args: {
                    params: {},
                    body: {
                        email: "new@example.com",
                        displayName: "New User",
                        password: "supersecret",
                        permission: "full"
                    }
                }
            }
        ]);
        expect(result).toEqual(user({ email: "new@example.com" }));
    });

    it("update() calls updateUserRoute with id and body and returns the item", async () => {
        const gateway = createGateway();
        mockResult = { item: user({ displayName: "Updated" }) };

        const result = await gateway.update("user-1", { displayName: "Updated" });

        expect(calls).toEqual([
            {
                route: updateUserRoute,
                args: { params: { id: "user-1" }, body: { displayName: "Updated" } }
            }
        ]);
        expect(result).toEqual(user({ displayName: "Updated" }));
    });

    it("remove() calls deleteUserRoute with the id", async () => {
        const gateway = createGateway();
        mockResult = undefined;

        await gateway.remove("user-1");

        expect(calls).toEqual([{ route: deleteUserRoute, args: { params: { id: "user-1" } } }]);
    });

    it("forceLogout() calls forceLogoutUserRoute with the id", async () => {
        const gateway = createGateway();
        mockResult = undefined;

        await gateway.forceLogout("user-1");

        expect(calls).toEqual([
            { route: forceLogoutUserRoute, args: { params: { id: "user-1" } } }
        ]);
    });
});
