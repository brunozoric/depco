import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { ListLicensesUseCase } from "../abstractions/ListLicensesUseCase.js";

function createStubLicenseQueryService(): LicenseQueryService.Interface {
    return {
        listLicenses: vi.fn(),
        listProjectLicenses: vi.fn(),
        getLicenseSummary: vi.fn(),
        listViolations: vi.fn(),
        getViolationsSummary: vi.fn()
    };
}

describe("ListLicensesUseCase", () => {
    let useCase: ListLicensesUseCase.Interface;
    let licenseQueryService: LicenseQueryService.Interface;

    function createUseCase(): ListLicensesUseCase.Interface {
        const { container } = createTestApiContainer();
        licenseQueryService = createStubLicenseQueryService();
        container.registerInstance(LicenseQueryService, licenseQueryService);
        return container.resolve(ListLicensesUseCase);
    }

    beforeEach(() => {
        useCase = createUseCase();
    });

    it("returns the licenses reported by the query service", async () => {
        const fixture: ListLicensesUseCase.Data = {
            items: [
                {
                    id: "lic-1",
                    projectId: "p1",
                    packageName: "react",
                    licenseName: "MIT",
                    spdxId: "MIT",
                    source: "registry",
                    riskTier: "permissive",
                    licenseUrl: null,
                    scannedAt: 1000
                }
            ],
            total: 1
        };
        vi.mocked(licenseQueryService.listLicenses).mockResolvedValue(fixture);

        const params: ListLicensesUseCase.Params = { projectId: "p1" };
        const result = await useCase.execute(params);

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixture);
        }
        expect(licenseQueryService.listLicenses).toHaveBeenCalledWith(params);
    });

    it("wraps a thrown error from the query service into a 500 failure", async () => {
        vi.mocked(licenseQueryService.listLicenses).mockRejectedValue(new Error("boom"));

        const result = await useCase.execute({ projectId: "p1" });

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
