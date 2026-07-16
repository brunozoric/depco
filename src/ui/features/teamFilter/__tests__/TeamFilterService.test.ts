import { describe, it, expect, beforeEach } from "vitest";
import { Result, Cache } from "@webiny/stdlib";
import type { ICache, CacheError } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { TeamFilterService } from "../abstractions/TeamFilterService.js";
import { TeamFilterService as TeamFilterServiceRegistration } from "../TeamFilterService.js";

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

describe("TeamFilterService", () => {
    let cache: InMemoryCache;

    function createService(): TeamFilterService.Interface {
        const container = createContainer();
        container.registerInstance(Cache, cache);
        container.register(TeamFilterServiceRegistration);
        return container.resolve(TeamFilterService);
    }

    beforeEach(() => {
        cache = new InMemoryCache();
    });

    it("has a null selectedTeamId when the cache is empty", () => {
        const service = createService();
        expect(service.selectedTeamId).toBeNull();
    });

    it("restores selectedTeamId from the cache on construction", () => {
        cache.set("team-filter:selectedTeamId", "team-1");
        const service = createService();
        expect(service.selectedTeamId).toBe("team-1");
    });

    it("updates the observable and persists to the cache when setSelectedTeamId is called", () => {
        const service = createService();
        service.setSelectedTeamId("team-2");

        expect(service.selectedTeamId).toBe("team-2");
        expect(cache.get<string>("team-filter:selectedTeamId").value).toBe("team-2");
    });

    it("clears the cache entry when setSelectedTeamId is called with null", () => {
        const service = createService();
        service.setSelectedTeamId("team-3");
        service.setSelectedTeamId(null);

        expect(service.selectedTeamId).toBeNull();
        expect(cache.has("team-filter:selectedTeamId").value).toBe(false);
    });

    it("persists the latest value across multiple set calls", () => {
        const service = createService();
        service.setSelectedTeamId("team-4");
        service.setSelectedTeamId("team-5");
        service.setSelectedTeamId("team-6");

        expect(service.selectedTeamId).toBe("team-6");
        expect(cache.get<string>("team-filter:selectedTeamId").value).toBe("team-6");
    });
});
