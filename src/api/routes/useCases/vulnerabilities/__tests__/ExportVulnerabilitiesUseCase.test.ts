import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { VulnerabilityQueryService } from "#api/services/Vulnerability/index.js";
import { ExportVulnerabilitiesUseCase } from "../abstractions/ExportVulnerabilitiesUseCase.js";
import { createVulnerabilityQueryServiceStub } from "./vulnerabilitiesUseCasesTestHelpers.js";

function createUseCase(
    vulnerabilityQueryService: VulnerabilityQueryService.Interface
): ExportVulnerabilitiesUseCase.Interface {
    const { container } = createTestApiContainer();
    container.registerInstance(VulnerabilityQueryService, vulnerabilityQueryService);
    return container.resolve(ExportVulnerabilitiesUseCase);
}

describe("ExportVulnerabilitiesUseCase", () => {
    it("returns the export result from the query service", async () => {
        const fixtureResult: VulnerabilityQueryService.ExportResult = {
            contentType: "text/csv",
            filename: "vulnerabilities.csv",
            body: "id,packageName\nvuln-1,lodash\n"
        };
        const exportVulnerabilities = vi.fn(async () => fixtureResult);
        const useCase = createUseCase(
            createVulnerabilityQueryServiceStub({ exportVulnerabilities })
        );

        const result = await useCase.execute({ format: "csv", severity: "critical" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(fixtureResult);
        }
        expect(exportVulnerabilities).toHaveBeenCalledWith({ format: "csv", severity: "critical" });
    });

    it("returns a 500 error when the query service throws", async () => {
        const exportVulnerabilities = vi.fn(async () => {
            throw new Error("boom");
        });
        const useCase = createUseCase(
            createVulnerabilityQueryServiceStub({ exportVulnerabilities })
        );

        const result = await useCase.execute({ format: "json" });

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
