import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { ListLicenseViolationsUseCase } from "../abstractions/ListLicenseViolationsUseCase.js";

function createStubLicenseQueryService(): LicenseQueryService.Interface {
    return {
        listLicenses: vi.fn(),
        listProjectLicenses: vi.fn(),
        getLicenseSummary: vi.fn(),
        listViolations: vi.fn(),
        getViolationsSummary: vi.fn()
    };
}

describe("ListLicenseViolationsUseCase", () => {
    let useCase: ListLicenseViolationsUseCase.Interface;
    let licenseQueryService: LicenseQueryService.Interface;

    function createUseCase(): ListLicenseViolationsUseCase.Interface {
        const { container } = createTestApiContainer();
        licenseQueryService = createStubLicenseQueryService();
        container.registerInstance(LicenseQueryService, licenseQueryService);
        return container.resolve(ListLicenseViolationsUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("returns the violations reported by the query service", async () => {
        const fixture: ListLicenseViolationsUseCase.Data = {
            items: [
                {
                    id: "viol-1",
                    licenseId: "lic-1",
                    ruleId: "rule-1",
                    projectId: "p1",
                    packageName: "gpl-lib",
                    action: "deny",
                    scannedAt: 3000
                }
            ],
            total: 1
        };
        vi.mocked(licenseQueryService.listViolations).mockResolvedValue(fixture);

        const params: ListLicenseViolationsUseCase.Params = { projectId: "p1" };
        const result = await useCase.execute(params);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(licenseQueryService.listViolations).toHaveBeenCalledWith(params);
    });

    it("wraps a thrown error from the query service into a 500 failure", async () => {
        vi.mocked(licenseQueryService.listViolations).mockRejectedValue(new Error("boom"));

        const result = await useCase.execute({ projectId: "p1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "boom" });
        }
    });
});
