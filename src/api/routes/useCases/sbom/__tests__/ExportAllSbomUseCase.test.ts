import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { SbomService, SbomFormatterRegistry } from "#api/services/Sbom/index.js";
import { SbomUseCasesFeature } from "../feature.js";
import { ExportAllSbomUseCase } from "../abstractions/ExportAllSbomUseCase.js";

interface ICreateContextOptions {
    sbomService?: Partial<SbomService.Interface>;
    sbomFormatterRegistry?: Partial<SbomFormatterRegistry.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ExportAllSbomUseCase.Interface;
}

function createSbomProjectData(
    overrides: Partial<SbomService.ProjectData> = {}
): SbomService.ProjectData {
    return {
        projectName: "All Projects",
        projectPath: "",
        packageManager: null,
        components: [],
        vulnerabilities: [],
        edges: [],
        ...overrides
    };
}

function createSbomServiceStub(overrides?: Partial<SbomService.Interface>): SbomService.Interface {
    return {
        collectForProject: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        collectForAllProjects: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createSbomFormatterRegistryStub(
    overrides?: Partial<SbomFormatterRegistry.Interface>
): SbomFormatterRegistry.Interface {
    return {
        get: vi.fn(() => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    SbomUseCasesFeature.register(container);
    container.registerInstance(SbomService, createSbomServiceStub(options.sbomService));
    container.registerInstance(
        SbomFormatterRegistry,
        createSbomFormatterRegistryStub(options.sbomFormatterRegistry)
    );

    return { container, useCase: container.resolve(ExportAllSbomUseCase) };
}

describe("ExportAllSbomUseCase", () => {
    it("formats the aggregate SBOM data using the requested formatter", async () => {
        const projectData = createSbomProjectData({
            components: [
                {
                    packageName: "react",
                    version: "18.2.0",
                    spdxId: "MIT",
                    licenseName: "MIT",
                    type: "dependency"
                }
            ]
        });
        const collectForAllProjects = vi.fn(async () => projectData);
        const formatterResult = {
            content: { bomFormat: "CycloneDX" },
            filename: "sbom-all.cdx.json",
            mediaType: "application/json"
        };
        const format = vi.fn(() => formatterResult);
        const get = vi.fn(() => ({ name: "cyclonedx", format }));
        const { useCase } = createContext({
            sbomService: { collectForAllProjects },
            sbomFormatterRegistry: { get }
        });

        const result = await useCase.execute({ format: "cyclonedx" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(formatterResult);
        }
        expect(get).toHaveBeenCalledWith("cyclonedx");
        expect(format).toHaveBeenCalledWith(projectData);
    });

    it("fails with 500 when the requested format is unknown", async () => {
        const get = vi.fn(() => {
            throw new Error("Unknown SBOM format: bogus");
        });
        const { useCase } = createContext({ sbomFormatterRegistry: { get } });

        const result = await useCase.execute({ format: "bogus" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "Unknown SBOM format: bogus"
            });
        }
    });

    it("fails with 500 when the SBOM service throws", async () => {
        const format = vi.fn();
        const get = vi.fn(() => ({ name: "cyclonedx", format }));
        const collectForAllProjects = vi.fn(async () => {
            throw new Error("aggregation failed");
        });
        const { useCase } = createContext({
            sbomService: { collectForAllProjects },
            sbomFormatterRegistry: { get }
        });

        const result = await useCase.execute({ format: "cyclonedx" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "aggregation failed"
            });
        }
        expect(format).not.toHaveBeenCalled();
    });
});
