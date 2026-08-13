import { describe, it, expect, beforeEach } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { UserService } from "#api/services/Auth/index.js";
import { ListUsersUseCase } from "../abstractions/ListUsersUseCase.js";

describe("ListUsersUseCase", () => {
    let useCase: ListUsersUseCase.Interface;

    beforeEach(async () => {
        const { container } = createTestApiContainer();
        const userService = container.resolve(UserService);
        useCase = container.resolve(ListUsersUseCase);

        await userService.create({
            email: "alice@example.com",
            displayName: "Alice",
            password: "password123",
            permission: "full"
        });
        const bob = await userService.create({
            email: "bob@example.com",
            displayName: "Bob",
            password: "password123",
            permission: "read-only"
        });
        await userService.deactivate(bob.id);
    });

    it("lists all users with default sort/pagination", async () => {
        const result = await useCase.execute({
            page: 1,
            pageSize: 50,
            sortBy: "email",
            sortOrder: "asc"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBe(2);
        expect(result.value.items.map(user => user.email)).toEqual([
            "alice@example.com",
            "bob@example.com"
        ]);
    });

    it("filters by search term", async () => {
        const result = await useCase.execute({
            search: "alice",
            page: 1,
            pageSize: 50,
            sortBy: "email",
            sortOrder: "asc"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBe(1);
        expect(result.value.items[0]?.email).toBe("alice@example.com");
    });

    it("filters by isActive", async () => {
        const result = await useCase.execute({
            isActive: false,
            page: 1,
            pageSize: 50,
            sortBy: "email",
            sortOrder: "asc"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBe(1);
        expect(result.value.items[0]?.email).toBe("bob@example.com");
    });

    it("paginates results", async () => {
        const result = await useCase.execute({
            page: 2,
            pageSize: 1,
            sortBy: "email",
            sortOrder: "asc"
        });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.total).toBe(2);
        expect(result.value.items).toHaveLength(1);
        expect(result.value.items[0]?.email).toBe("bob@example.com");
    });
});
