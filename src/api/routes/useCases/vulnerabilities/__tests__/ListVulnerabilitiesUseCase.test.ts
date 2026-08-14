import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import {
    VulnerabilityQueryService,
    VulnerabilityService
} from "#api/services/Vulnerability/index.js";
import { ListVulnerabilitiesUseCase } from "../abstractions/ListVulnerabilitiesUseCase.js";
import {
    createVulnerabilityQueryServiceStub,
    createEnrichedVulnerabilityFixture
} from "./vulnerabilitiesUseCasesTestHelpers.js";

function createUseCase(
    vulnerabilityQueryService: VulnerabilityQueryService.Interface
): ListVulnerabilitiesUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(VulnerabilityQueryService, vulnerabilityQueryService);
    return container.resolve(ListVulnerabilitiesUseCase);
}

describe("ListVulnerabilitiesUseCase", () => {
    it("returns the enriched result from the query service", async () => {
        const fixtureResult: VulnerabilityService.EnrichedVulnerabilityResult = {
            items: [createEnrichedVulnerabilityFixture()],
            total: 1
        };
        const listVulnerabilities = vi.fn(async () => fixtureResult);
        const useCase = createUseCase(createVulnerabilityQueryServiceStub({ listVulnerabilities }));

        const result = await useCase.execute({ severity: "critical" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixtureResult);
        }
        expect(listVulnerabilities).toHaveBeenCalledWith({ severity: "critical" });
    });

    it("returns a 500 error when the query service throws", async () => {
        const listVulnerabilities = vi.fn(async () => {
            throw new Error("boom");
        });
        const useCase = createUseCase(createVulnerabilityQueryServiceStub({ listVulnerabilities }));

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: "boom"
            });
        }
    });
});
