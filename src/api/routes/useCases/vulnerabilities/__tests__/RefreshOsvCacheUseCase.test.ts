import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { RefreshOsvCacheUseCase } from "../abstractions/RefreshOsvCacheUseCase.js";
import { createVulnerabilityServiceStub } from "./vulnerabilitiesUseCasesTestHelpers.js";

function createUseCase(
    vulnerabilityService: VulnerabilityService.Interface
): RefreshOsvCacheUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(VulnerabilityService, vulnerabilityService);
    return container.resolve(RefreshOsvCacheUseCase);
}

describe("RefreshOsvCacheUseCase", () => {
    it("wraps the invalidated count returned by the service", async () => {
        const forceOsvRefresh = vi.fn(async () => 7);
        const useCase = createUseCase(createVulnerabilityServiceStub({ forceOsvRefresh }));

        const result = await useCase.execute({ packageName: "lodash" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ invalidated: 7 });
        }
        expect(forceOsvRefresh).toHaveBeenCalledWith({ packageName: "lodash" });
    });

    it("returns a 500 error when the service throws", async () => {
        const forceOsvRefresh = vi.fn(async () => {
            throw new Error("boom");
        });
        const useCase = createUseCase(createVulnerabilityServiceStub({ forceOsvRefresh }));

        const result = await useCase.execute({ all: true });

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
