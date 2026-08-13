import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import type { INodeRelease } from "#shared/engines/types.js";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { NodeReleaseDataService } from "#api/services/Engine/index.js";
import { EnginesUseCasesFeature } from "../feature.js";
import { ListNodeReleasesUseCase } from "../abstractions/ListNodeReleasesUseCase.js";

interface ICreateContextOptions {
    nodeReleaseDataService?: Partial<NodeReleaseDataService.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ListNodeReleasesUseCase.Interface;
}

function createNodeReleaseDataServiceStub(
    overrides?: Partial<NodeReleaseDataService.Interface>
): NodeReleaseDataService.Interface {
    return {
        getSchedule: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    EnginesUseCasesFeature.register(container);
    container.registerInstance(
        NodeReleaseDataService,
        createNodeReleaseDataServiceStub(options.nodeReleaseDataService)
    );

    return { container, useCase: container.resolve(ListNodeReleasesUseCase) };
}

describe("ListNodeReleasesUseCase", () => {
    it("returns the Node.js release schedule", async () => {
        const releases: INodeRelease[] = [
            {
                version: 18,
                codename: "Hydrogen",
                releaseDate: Date.UTC(2022, 3, 19),
                ltsStart: Date.UTC(2022, 9, 25),
                maintenanceStart: Date.UTC(2023, 9, 18),
                eolDate: Date.UTC(2025, 3, 30)
            },
            {
                version: 20,
                codename: "Iron",
                releaseDate: Date.UTC(2023, 3, 18),
                ltsStart: Date.UTC(2023, 9, 24),
                maintenanceStart: Date.UTC(2024, 9, 22),
                eolDate: Date.UTC(2026, 3, 30)
            }
        ];
        const getSchedule = vi.fn(async () => releases);
        const { useCase } = createContext({ nodeReleaseDataService: { getSchedule } });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ items: releases, total: 2 });
    });

    it("fails with 500 when the schedule cannot be loaded", async () => {
        const getSchedule = vi.fn(async () => {
            throw new Error("endoflife.date unreachable");
        });
        const { useCase } = createContext({ nodeReleaseDataService: { getSchedule } });

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({
            statusCode: 500,
            message: "endoflife.date unreachable"
        });
    });
});
