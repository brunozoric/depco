import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { EngineService } from "#api/services/Engine/index.js";
import { EnginesUseCasesFeature } from "../feature.js";
import { GetProjectEngineChecksUseCase } from "../abstractions/GetProjectEngineChecksUseCase.js";

interface ICreateContextOptions {
    engineService?: Partial<EngineService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetProjectEngineChecksUseCase.Interface;
}

function createEngineServiceStub(
    overrides?: Partial<EngineService.Interface>
): EngineService.Interface {
    return {
        scan: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getByProject: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getSummary: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    EnginesUseCasesFeature.register(container);
    container.registerInstance(EngineService, createEngineServiceStub(options.engineService));

    return { container, useCase: container.resolve(GetProjectEngineChecksUseCase) };
}

describe("GetProjectEngineChecksUseCase", () => {
    it("returns the engine checks for a project", async () => {
        const checks: EngineService.Check[] = [
            {
                id: "check-1",
                projectId: "project-1",
                packageName: "",
                enginesNode: ">=18",
                minimumMajor: 18,
                status: "active-lts",
                eolDate: null,
                scannedAt: Date.now()
            }
        ];
        const getByProject = vi.fn(async () => checks);
        const { useCase } = createContext({ engineService: { getByProject } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ items: checks, total: 1 });
        expect(getByProject).toHaveBeenCalledWith("project-1");
    });

    it("returns an empty list when the project has no engine checks", async () => {
        const { useCase } = createContext({
            engineService: { getByProject: vi.fn(async () => []) }
        });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ items: [], total: 0 });
    });

    it("fails with 500 when the engine service throws", async () => {
        const getByProject = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ engineService: { getByProject } });

        const result = await useCase.execute({ projectId: "project-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "db unavailable"
        });
    });
});
