import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { PackageQueryService } from "#api/services/Package/index.js";
import { PackagesUseCasesFeature } from "../feature.js";
import { ListPackagesUseCase } from "../abstractions/ListPackagesUseCase.js";

interface ICreateContextOptions {
    packageQueryService?: Partial<PackageQueryService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ListPackagesUseCase.Interface;
}

function createPackageQueryServiceStub(
    overrides?: Partial<PackageQueryService.Interface>
): PackageQueryService.Interface {
    return {
        listPackages: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getPackageDetail: vi.fn(async () => null),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    PackagesUseCasesFeature.register(container);
    container.registerInstance(
        PackageQueryService,
        createPackageQueryServiceStub(options.packageQueryService)
    );

    return { container, useCase: container.resolve(ListPackagesUseCase) };
}

describe("ListPackagesUseCase", () => {
    it("returns the paginated list reported by the package query service", async () => {
        const fixture: ListPackagesUseCase.Data = {
            items: [
                {
                    name: "react",
                    projects: [
                        {
                            projectId: "project-1",
                            projectName: "Project One",
                            currentVersion: "18.0.0",
                            latestVersion: "18.2.0",
                            upgradeType: "minor"
                        }
                    ],
                    resolvedChangelogCount: 1,
                    totalChangelogCount: 1,
                    lastPublishedAt: 1700000000000,
                    dependencyKind: "dependency",
                    registryResolved: true
                }
            ],
            total: 1
        };
        const listPackages = vi.fn(async () => fixture);
        const { useCase } = createContext({ packageQueryService: { listPackages } });

        const params: ListPackagesUseCase.Params = { search: "react", page: 1, pageSize: 25 };
        const result = await useCase.execute(params);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(listPackages).toHaveBeenCalledWith(params);
    });

    it("fails with 500 when the package query service throws", async () => {
        const listPackages = vi.fn(async () => {
            throw new Error("query failed");
        });
        const { useCase } = createContext({ packageQueryService: { listPackages } });

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "query failed" });
        }
    });
});
