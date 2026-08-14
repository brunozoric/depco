import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { CacheUseCasesFeature } from "../feature.js";
import { ClearCacheUseCase } from "../abstractions/ClearCacheUseCase.js";

interface ICreateContextOptions {
    registryCacheService?: Partial<RegistryCacheService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ClearCacheUseCase.Interface;
}

function createRegistryCacheServiceStub(
    overrides?: Partial<RegistryCacheService.Interface>
): RegistryCacheService.Interface {
    return {
        getPackageInfo: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        clearAll: vi.fn(async () => {}),
        clearPackage: vi.fn(async () => {}),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    CacheUseCasesFeature.register(container);
    container.registerInstance(
        RegistryCacheService,
        createRegistryCacheServiceStub(options.registryCacheService)
    );

    return { container, useCase: container.resolve(ClearCacheUseCase) };
}

describe("ClearCacheUseCase", () => {
    it("clears the entire registry cache", async () => {
        const clearAll = vi.fn(async () => {});
        const { useCase } = createContext({ registryCacheService: { clearAll } });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ success: true });
        expect(clearAll).toHaveBeenCalledOnce();
    });

    it("fails with 500 when clearing the cache throws", async () => {
        const clearAll = vi.fn(async () => {
            throw new Error("cache backend unavailable");
        });
        const { useCase } = createContext({ registryCacheService: { clearAll } });

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "cache backend unavailable"
        });
    });
});
