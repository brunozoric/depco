import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import {
    VulnerabilityQueryService,
    VulnerabilityService
} from "#api/services/Vulnerability/index.js";
import { GetProjectVulnerabilitiesUseCase } from "../abstractions/GetProjectVulnerabilitiesUseCase.js";
import {
    createVulnerabilityQueryServiceStub,
    createEnrichedVulnerabilityFixture
} from "./vulnerabilitiesUseCasesTestHelpers.js";

function createUseCase(
    vulnerabilityQueryService: VulnerabilityQueryService.Interface
): GetProjectVulnerabilitiesUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(VulnerabilityQueryService, vulnerabilityQueryService);
    return container.resolve(GetProjectVulnerabilitiesUseCase);
}

describe("GetProjectVulnerabilitiesUseCase", () => {
    it("passes projectId and query through to listProjectVulnerabilities", async () => {
        const fixtureResult: VulnerabilityService.EnrichedVulnerabilityResult = {
            items: [createEnrichedVulnerabilityFixture()],
            total: 1
        };
        const listProjectVulnerabilities = vi.fn(async () => fixtureResult);
        const useCase = createUseCase(
            createVulnerabilityQueryServiceStub({ listProjectVulnerabilities })
        );

        const result = await useCase.execute({
            projectId: "proj-1",
            query: { severity: "high" }
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixtureResult);
        }
        expect(listProjectVulnerabilities).toHaveBeenCalledWith({
            projectId: "proj-1",
            query: { severity: "high" }
        });
    });

    it("returns a 500 error when the query service throws", async () => {
        const listProjectVulnerabilities = vi.fn(async () => {
            throw new Error("boom");
        });
        const useCase = createUseCase(
            createVulnerabilityQueryServiceStub({ listProjectVulnerabilities })
        );

        const result = await useCase.execute({ projectId: "proj-1", query: {} });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "boom" });
        }
    });
});
