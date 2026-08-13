import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { GetLicenseSummaryUseCase } from "../abstractions/GetLicenseSummaryUseCase.js";

function createStubLicenseQueryService(): LicenseQueryService.Interface {
    return {
        listLicenses: vi.fn(),
        listProjectLicenses: vi.fn(),
        getLicenseSummary: vi.fn(),
        listViolations: vi.fn(),
        getViolationsSummary: vi.fn()
    };
}

describe("GetLicenseSummaryUseCase", () => {
    let useCase: GetLicenseSummaryUseCase.Interface;
    let licenseQueryService: LicenseQueryService.Interface;

    function createUseCase(): GetLicenseSummaryUseCase.Interface {
        const { container } = createTestApiContainer();
        licenseQueryService = createStubLicenseQueryService();
        container.registerInstance(LicenseQueryService, licenseQueryService);
        return container.resolve(GetLicenseSummaryUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("returns the summary reported by the query service", async () => {
        const fixture: GetLicenseSummaryUseCase.Data = {
            totalPackages: 10,
            compliantPercent: 90,
            riskTierCounts: {
                permissive: 8,
                "weak-copyleft": 1,
                copyleft: 1,
                proprietary: 0,
                unknown: 0
            },
            violationCounts: { warn: 1, deny: 0 },
            projectSummaries: [
                { projectId: "p1", projectName: "Project One", total: 10, denied: 0, warned: 1 }
            ]
        };
        vi.mocked(licenseQueryService.getLicenseSummary).mockResolvedValue(fixture);

        const params: GetLicenseSummaryUseCase.Params = { teamId: "team-1" };
        const result = await useCase.execute(params);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(licenseQueryService.getLicenseSummary).toHaveBeenCalledWith(params);
    });

    it("wraps a thrown error from the query service into a 500 failure", async () => {
        vi.mocked(licenseQueryService.getLicenseSummary).mockRejectedValue(new Error("boom"));

        const result = await useCase.execute({ teamId: "team-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "boom" });
        }
    });
});
