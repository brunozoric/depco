import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { UsersRepository } from "../abstractions/UsersRepository.js";
import { UsersRepository as UsersRepositoryRegistration } from "../UsersRepository.js";
import type { UsersGateway } from "../abstractions/UsersGateway.js";

function createRepo(): UsersRepository.Interface {
    const container = createContainer();
    container.register(UsersRepositoryRegistration);
    return container.resolve(UsersRepository);
}

const exampleUser: UsersGateway.User = {
    id: "user-1",
    email: "jane@example.com",
    displayName: "Jane Doe",
    permission: "read-only",
    isActive: true,
    createdAt: 1000,
    updatedAt: 1000
};

describe("UsersRepository", () => {
    it("starts empty with no users and zero total", () => {
        const repo = createRepo();

        expect(repo.getUsers()).toEqual([]);
        expect(repo.getTotal()).toBe(0);
    });

    it("stores users and total via setUsers and retrieves them via getters", () => {
        const repo = createRepo();

        repo.setUsers([exampleUser], 1);

        expect(repo.getUsers()).toEqual([exampleUser]);
        expect(repo.getTotal()).toBe(1);
    });

    it("overwrites previously stored users", () => {
        const repo = createRepo();
        repo.setUsers([exampleUser], 1);

        const otherUser: UsersGateway.User = {
            ...exampleUser,
            id: "user-2",
            email: "other@example.com"
        };
        repo.setUsers([otherUser], 5);

        expect(repo.getUsers()).toEqual([otherUser]);
        expect(repo.getTotal()).toBe(5);
    });
});
