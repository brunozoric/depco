import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { ChangelogsUseCasesFeature } from "../feature.js";
import { GetChangelogStatsUseCase } from "../abstractions/GetChangelogStatsUseCase.js";

interface ICreateContextOptions {
    changelogService?: Partial<ChangelogService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: GetChangelogStatsUseCase.Interface;
}

function createChangelogServiceStub(
    overrides?: Partial<ChangelogService.Interface>
): ChangelogService.Interface {
    return {
        resolve: vi.fn(async () => {}),
        resetFailed: vi.fn(async () => {}),
        resetAllFailed: vi.fn(async () => []),
        getChangelogs: vi.fn(async () => []),
        getStats: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    ChangelogsUseCasesFeature.register(container);
    container.registerInstance(
        ChangelogService,
        createChangelogServiceStub(options.changelogService)
    );

    return { container, useCase: container.resolve(GetChangelogStatsUseCase) };
}

describe("GetChangelogStatsUseCase", () => {
    it("returns the changelog stats from the service", async () => {
        const stats: ChangelogService.Stats = {
            total: 10,
            resolved: 6,
            failed: 1,
            pending: 3,
            byResolver: { "github-releases": 5, "npm-readme": 1 }
        };
        const getStats = vi.fn(async () => stats);
        const { useCase } = createContext({ changelogService: { getStats } });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual(stats);
    });

    it("fails with 500 when the changelog service throws", async () => {
        const getStats = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ changelogService: { getStats } });

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            code: "UNEXPECTED_ERROR",
            statusCode: 500,
            message: "db unavailable"
        });
    });
});
