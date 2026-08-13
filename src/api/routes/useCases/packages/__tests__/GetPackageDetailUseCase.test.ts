import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { PackageQueryService } from "#api/services/Package/index.js";
import { PackagesUseCasesFeature } from "../feature.js";
import { GetPackageDetailUseCase } from "../abstractions/GetPackageDetailUseCase.js";

interface ICreateContextOptions {
    packageQueryService?: Partial<PackageQueryService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetPackageDetailUseCase.Interface;
}

function createPackageQueryServiceStub(
    overrides?: Partial<PackageQueryService.Interface>
): PackageQueryService.Interface {
    return {
        listPackages: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getPackageDetail: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
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

    return { container, useCase: container.resolve(GetPackageDetailUseCase) };
}

describe("GetPackageDetailUseCase", () => {
    it("returns the package detail reported by the package query service", async () => {
        const fixture: GetPackageDetailUseCase.Data = {
            name: "react",
            repoUrl: "https://github.com/facebook/react",
            projects: [
                {
                    projectId: "project-1",
                    projectName: "Project One",
                    currentVersion: "18.0.0",
                    latestVersion: "18.2.0",
                    upgradeType: "minor",
                    dependencyKind: "dependency"
                }
            ],
            latestVersion: "18.2.0",
            lastPublishedAt: 1700000000000,
            registryResolved: true
        };
        const getPackageDetail = vi.fn(async () => fixture);
        const { useCase } = createContext({ packageQueryService: { getPackageDetail } });

        const result = await useCase.execute({ packageName: "react" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(getPackageDetail).toHaveBeenCalledWith("react");
    });

    it("fails with 404 when the package query service finds nothing", async () => {
        const getPackageDetail = vi.fn(async () => null);
        const { useCase } = createContext({ packageQueryService: { getPackageDetail } });

        const result = await useCase.execute({ packageName: "does-not-exist" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 404, message: "Package not found" });
        }
    });

    it("fails with 500 when the package query service throws", async () => {
        const getPackageDetail = vi.fn(async () => {
            throw new Error("query failed");
        });
        const { useCase } = createContext({ packageQueryService: { getPackageDetail } });

        const result = await useCase.execute({ packageName: "react" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "query failed" });
        }
    });
});
