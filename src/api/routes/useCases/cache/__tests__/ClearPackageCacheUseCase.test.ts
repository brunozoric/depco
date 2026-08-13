import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { RegistryCacheService } from "#api/services/RegistryCache/index.js";
import { CacheUseCasesFeature } from "../feature.js";
import { ClearPackageCacheUseCase } from "../abstractions/ClearPackageCacheUseCase.js";

interface ICreateContextOptions {
    registryCacheService?: Partial<RegistryCacheService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ClearPackageCacheUseCase.Interface;
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

    return { container, useCase: container.resolve(ClearPackageCacheUseCase) };
}

describe("ClearPackageCacheUseCase", () => {
    it("clears the registry cache entry for a single package", async () => {
        const clearPackage = vi.fn(async () => {});
        const { useCase } = createContext({ registryCacheService: { clearPackage } });

        const result = await useCase.execute({ packageName: "react" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ success: true });
        expect(clearPackage).toHaveBeenCalledWith("react");
    });

    it("fails with 500 when clearing the package cache throws", async () => {
        const clearPackage = vi.fn(async () => {
            throw new Error("cache backend unavailable");
        });
        const { useCase } = createContext({ registryCacheService: { clearPackage } });

        const result = await useCase.execute({ packageName: "react" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            statusCode: 500,
            message: "cache backend unavailable"
        });
    });
});
