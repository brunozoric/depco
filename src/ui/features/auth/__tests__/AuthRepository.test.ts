import { describe, it, expect, beforeEach } from "vitest";
import { Result, Cache } from "@webiny/stdlib";
import type { ICache, CacheError } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { AuthRepository } from "../abstractions/AuthRepository.js";
import { AuthRepository as AuthRepositoryRegistration } from "../AuthRepository.js";

class InMemoryCache implements ICache {
    private readonly store = new Map<string, unknown>();

    public get<T>(key: string): Result<T | null, CacheError<any>> {
        const value = this.store.has(key) ? (this.store.get(key) as T) : null;
        return Result.ok(value);
    }

    public set<T>(key: string, value: T): Result<void, CacheError<any>> {
        this.store.set(key, value);
        return Result.ok();
    }

    public remove(key: string): Result<void, CacheError<any>> {
        this.store.delete(key);
        return Result.ok();
    }

    public has(key: string): Result<boolean, CacheError<any>> {
        return Result.ok(this.store.has(key));
    }

    public clear(): Result<void, CacheError<any>> {
        this.store.clear();
        return Result.ok();
    }

    public keys(): Result<string[], CacheError<any>> {
        return Result.ok(Array.from(this.store.keys()));
    }

    public getOrSet<T>(key: string, factory: () => T): Result<T, CacheError<any>> {
        if (!this.store.has(key)) {
            this.store.set(key, factory());
        }
        return Result.ok(this.store.get(key) as T);
    }

    public byPrefix(_prefix: string): ICache {
        return this;
    }
}

const USER = {
    id: "u1",
    email: "user@example.com",
    displayName: "User",
    permission: "full" as const,
    isActive: true,
    createdAt: 1,
    updatedAt: 1
};

describe("AuthRepository", () => {
    let cache: InMemoryCache;

    function createRepository(): AuthRepository.Interface {
        const container = createContainer();
        container.registerInstance(Cache, cache);
        container.register(AuthRepositoryRegistration);
        return container.resolve(AuthRepository);
    }

    beforeEach(() => {
        cache = new InMemoryCache();
    });

    it("has no token and is not authenticated when the cache is empty", () => {
        const repository = createRepository();

        expect(repository.token).toBeNull();
        expect(repository.currentUser).toBeNull();
        expect(repository.isAuthenticated).toBe(false);
    });

    it("restores token and user from the cache on construction", () => {
        cache.set("auth:token", "cached-token");
        cache.set("auth:user", USER);

        const repository = createRepository();

        expect(repository.token).toBe("cached-token");
        expect(repository.currentUser).toEqual(USER);
        expect(repository.isAuthenticated).toBe(true);
    });

    it("setAuth() stores the token and user, and marks as authenticated", () => {
        const repository = createRepository();
        repository.setAuth({ token: "new-token", user: USER });

        expect(repository.token).toBe("new-token");
        expect(repository.currentUser).toEqual(USER);
        expect(repository.isAuthenticated).toBe(true);
        expect(cache.get("auth:token").value).toBe("new-token");
        expect(cache.get("auth:user").value).toEqual(USER);
    });

    it("clearAuth() removes the token and user, and marks as unauthenticated", () => {
        const repository = createRepository();
        repository.setAuth({ token: "new-token", user: USER });
        repository.clearAuth();

        expect(repository.token).toBeNull();
        expect(repository.currentUser).toBeNull();
        expect(repository.isAuthenticated).toBe(false);
        expect(cache.has("auth:token").value).toBe(false);
        expect(cache.has("auth:user").value).toBe(false);
    });
});
