import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { UserService } from "../abstractions/UserService.js";
import { UserService as UserServiceRegistration } from "../UserService.js";

describe("UserService", () => {
    let userService: UserService.Interface;

    beforeEach(() => {
        const databaseClient = createTestDatabaseClient();
        const container = createContainer();
        container.registerInstance(DatabaseClient, databaseClient);
        container.register(UserServiceRegistration).inSingletonScope();
        userService = container.resolve(UserService);
    });

    describe("create", () => {
        it("should create a user with hashed password", async () => {
            const user = await userService.create({
                email: "test@example.com",
                displayName: "Test User",
                password: "password123",
                permission: "full"
            });

            expect(user.id).toBeDefined();
            expect(user.email).toBe("test@example.com");
            expect(user.displayName).toBe("Test User");
            expect(user.permission).toBe("full");
            expect(user.isActive).toBe(true);
            expect(user).not.toHaveProperty("passwordHash");
        });

        it("should lowercase and trim email", async () => {
            const user = await userService.create({
                email: "  Test@EXAMPLE.com  ",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            expect(user.email).toBe("test@example.com");
        });

        it("should reject duplicate email", async () => {
            await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            await expect(
                userService.create({
                    email: "test@example.com",
                    displayName: "Test 2",
                    password: "password456",
                    permission: "read-only"
                })
            ).rejects.toThrow();
        });
    });

    describe("getById", () => {
        it("should return user without passwordHash", async () => {
            const created = await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            const user = await userService.getById(created.id);
            expect(user).not.toBeNull();
            expect(user!.email).toBe("test@example.com");
            expect(user).not.toHaveProperty("passwordHash");
        });

        it("should return null for unknown id", async () => {
            const user = await userService.getById("nonexistent");
            expect(user).toBeNull();
        });
    });

    describe("getByEmail", () => {
        it("should return user for matching email regardless of case", async () => {
            await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            const user = await userService.getByEmail("  TEST@example.com  ");
            expect(user).not.toBeNull();
            expect(user!.email).toBe("test@example.com");
        });

        it("should return null for unknown email", async () => {
            const user = await userService.getByEmail("nobody@example.com");
            expect(user).toBeNull();
        });
    });

    describe("verifyPassword", () => {
        it("should return true for correct password", async () => {
            const created = await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            const result = await userService.verifyPassword({
                userId: created.id,
                password: "password123"
            });
            expect(result).toBe(true);
        });

        it("should return false for wrong password", async () => {
            const created = await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            const result = await userService.verifyPassword({
                userId: created.id,
                password: "wrongpassword"
            });
            expect(result).toBe(false);
        });

        it("should return false for unknown user id", async () => {
            const result = await userService.verifyPassword({
                userId: "nonexistent",
                password: "password123"
            });
            expect(result).toBe(false);
        });
    });

    describe("list", () => {
        it("should return paginated users", async () => {
            await userService.create({
                email: "a@x.com",
                displayName: "A",
                password: "password123",
                permission: "full"
            });
            await userService.create({
                email: "b@x.com",
                displayName: "B",
                password: "password123",
                permission: "read-only"
            });

            const result = await userService.list({ page: 1, pageSize: 25 });
            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it("should filter by search", async () => {
            await userService.create({
                email: "alice@x.com",
                displayName: "Alice",
                password: "password123",
                permission: "full"
            });
            await userService.create({
                email: "bob@x.com",
                displayName: "Bob",
                password: "password123",
                permission: "full"
            });

            const result = await userService.list({ page: 1, pageSize: 25, search: "alice" });
            expect(result.items).toHaveLength(1);
            expect(result.items[0]!.email).toBe("alice@x.com");
        });

        it("should filter by isActive", async () => {
            await userService.create({
                email: "active@x.com",
                displayName: "Active",
                password: "password123",
                permission: "full"
            });
            const toDeactivate = await userService.create({
                email: "inactive@x.com",
                displayName: "Inactive",
                password: "password123",
                permission: "full"
            });
            await userService.deactivate(toDeactivate.id);

            const result = await userService.list({ page: 1, pageSize: 25, isActive: false });
            expect(result.items).toHaveLength(1);
            expect(result.items[0]!.email).toBe("inactive@x.com");
        });

        it("should paginate results", async () => {
            await userService.create({
                email: "a@x.com",
                displayName: "A",
                password: "password123",
                permission: "full"
            });
            await userService.create({
                email: "b@x.com",
                displayName: "B",
                password: "password123",
                permission: "full"
            });

            const result = await userService.list({ page: 1, pageSize: 1 });
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(2);
        });
    });

    describe("update", () => {
        it("should update display name", async () => {
            const created = await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            const updated = await userService.update({
                id: created.id,
                data: { displayName: "Updated Name" }
            });

            expect(updated!.displayName).toBe("Updated Name");
        });

        it("should update permission", async () => {
            const created = await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            const updated = await userService.update({
                id: created.id,
                data: { permission: "read-only" }
            });

            expect(updated!.permission).toBe("read-only");
        });

        it("should update password", async () => {
            const created = await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            await userService.update({
                id: created.id,
                data: { password: "newpassword123" }
            });

            const oldResult = await userService.verifyPassword({
                userId: created.id,
                password: "password123"
            });
            expect(oldResult).toBe(false);

            const newResult = await userService.verifyPassword({
                userId: created.id,
                password: "newpassword123"
            });
            expect(newResult).toBe(true);
        });
    });

    describe("deactivate", () => {
        it("should set isActive to false", async () => {
            const created = await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            await userService.deactivate(created.id);

            const user = await userService.getById(created.id);
            expect(user!.isActive).toBe(false);
        });
    });

    describe("hasAnyUsers", () => {
        it("should return false when no users exist", async () => {
            const result = await userService.hasAnyUsers();
            expect(result).toBe(false);
        });

        it("should return true when users exist", async () => {
            await userService.create({
                email: "test@example.com",
                displayName: "Test",
                password: "password123",
                permission: "full"
            });

            const result = await userService.hasAnyUsers();
            expect(result).toBe(true);
        });
    });
});
