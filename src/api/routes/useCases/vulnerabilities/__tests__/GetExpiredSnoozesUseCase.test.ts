import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { GetExpiredSnoozesUseCase } from "../abstractions/GetExpiredSnoozesUseCase.js";
import {
    createVulnerabilityServiceStub,
    createVulnerabilityFixture
} from "./vulnerabilitiesUseCasesTestHelpers.js";

function createUseCase(
    vulnerabilityService: VulnerabilityService.Interface
): GetExpiredSnoozesUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(VulnerabilityService, vulnerabilityService);
    return container.resolve(GetExpiredSnoozesUseCase);
}

describe("GetExpiredSnoozesUseCase", () => {
    it("returns the count and deduplicated package names of recently expired snoozes", async () => {
        const expired = [
            createVulnerabilityFixture({ id: "vuln-1", packageName: "lodash" }),
            createVulnerabilityFixture({ id: "vuln-2", packageName: "axios" }),
            createVulnerabilityFixture({ id: "vuln-3", packageName: "lodash" })
        ];
        const getRecentlyExpiredSnoozes = vi.fn(async () => expired);
        const useCase = createUseCase(
            createVulnerabilityServiceStub({ getRecentlyExpiredSnoozes })
        );

        const result = await useCase.execute({ since: 1700000000000 });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ count: 3, packageNames: ["lodash", "axios"] });
        }
        expect(getRecentlyExpiredSnoozes).toHaveBeenCalledWith(1700000000000);
    });

    it("returns a 500 error when the service throws", async () => {
        const getRecentlyExpiredSnoozes = vi.fn(async () => {
            throw new Error("boom");
        });
        const useCase = createUseCase(
            createVulnerabilityServiceStub({ getRecentlyExpiredSnoozes })
        );

        const result = await useCase.execute({ since: 0 });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "boom" });
        }
    });
});
