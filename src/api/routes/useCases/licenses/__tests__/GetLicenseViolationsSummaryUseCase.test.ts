import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { GetLicenseViolationsSummaryUseCase } from "../abstractions/GetLicenseViolationsSummaryUseCase.js";

function createStubLicenseQueryService(): LicenseQueryService.Interface {
    return {
        listLicenses: vi.fn(),
        listProjectLicenses: vi.fn(),
        getLicenseSummary: vi.fn(),
        listViolations: vi.fn(),
        getViolationsSummary: vi.fn()
    };
}

describe("GetLicenseViolationsSummaryUseCase", () => {
    let useCase: GetLicenseViolationsSummaryUseCase.Interface;
    let licenseQueryService: LicenseQueryService.Interface;

    function createUseCase(): GetLicenseViolationsSummaryUseCase.Interface {
        const { container } = createTestApiContainer();
        licenseQueryService = createStubLicenseQueryService();
        container.registerInstance(LicenseQueryService, licenseQueryService);
        return container.resolve(GetLicenseViolationsSummaryUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("returns the violations summary reported by the query service", async () => {
        const fixture: GetLicenseViolationsSummaryUseCase.Data = {
            total: 5,
            warnCount: 3,
            denyCount: 2,
            byProject: [{ projectId: "p1", projectName: "Project One", warnCount: 3, denyCount: 2 }]
        };
        vi.mocked(licenseQueryService.getViolationsSummary).mockResolvedValue(fixture);

        const params: GetLicenseViolationsSummaryUseCase.Params = { teamId: "team-1" };
        const result = await useCase.execute(params);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(licenseQueryService.getViolationsSummary).toHaveBeenCalledWith(params);
    });

    it("wraps a thrown error from the query service into a 500 failure", async () => {
        vi.mocked(licenseQueryService.getViolationsSummary).mockRejectedValue(new Error("boom"));

        const result = await useCase.execute({ teamId: "team-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "boom" });
        }
    });
});
