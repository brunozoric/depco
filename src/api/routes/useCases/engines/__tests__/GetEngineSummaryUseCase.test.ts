import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { EngineService } from "#api/services/Engine/index.js";
import { EnginesUseCasesFeature } from "../feature.js";
import { GetEngineSummaryUseCase } from "../abstractions/GetEngineSummaryUseCase.js";

interface ICreateContextOptions {
    engineService?: Partial<EngineService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetEngineSummaryUseCase.Interface;
}

function createEngineServiceStub(
    overrides?: Partial<EngineService.Interface>
): EngineService.Interface {
    return {
        scan: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getByProject: vi.fn(async () => []),
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

    return { container, useCase: container.resolve(GetEngineSummaryUseCase) };
}

describe("GetEngineSummaryUseCase", () => {
    it("returns the engine summary from the service", async () => {
        const summary: EngineService.Summary = {
            totalProjects: 2,
            counts: { eol: 1, maintenance: 0, activeLts: 1, current: 0, unknown: 0 },
            projectSummaries: [],
            staleProjectCount: 1,
            stalenessThresholdMs: 604_800_000
        };
        const getSummary = vi.fn(async () => summary);
        const { useCase } = createContext({ engineService: { getSummary } });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual(summary);
        expect(getSummary).toHaveBeenCalled();
    });

    it("fails with 500 when the engine service throws", async () => {
        const getSummary = vi.fn(async () => {
            throw new Error("summary computation failed");
        });
        const { useCase } = createContext({ engineService: { getSummary } });

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "summary computation failed"
        });
    });
});
