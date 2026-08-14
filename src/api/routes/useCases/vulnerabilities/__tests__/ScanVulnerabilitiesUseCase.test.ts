import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { ScanVulnerabilitiesUseCase } from "../abstractions/ScanVulnerabilitiesUseCase.js";
import {
    createVulnerabilityServiceStub,
    createSeverityCountsFixture,
    insertTestProject,
    type TestDb
} from "./vulnerabilitiesUseCasesTestHelpers.js";

function createUseCase(vulnerabilityService: VulnerabilityService.Interface): {
    useCase: ScanVulnerabilitiesUseCase.Interface;
    db: TestDb;
} {
    const { container, db } = createTestApiContainer();
    container.registerInstance(VulnerabilityService, vulnerabilityService);
    return { useCase: container.resolve(ScanVulnerabilitiesUseCase), db };
}

describe("ScanVulnerabilitiesUseCase", () => {
    it("scans the project and returns the total and counts", async () => {
        const scan = vi.fn(async () => ({
            vulnerabilities: [],
            counts: createSeverityCountsFixture({ critical: 1 }),
            total: 1
        }));
        const { useCase, db } = createUseCase(createVulnerabilityServiceStub({ scan }));
        await insertTestProject(db, "proj-1", { packageManager: "yarn" });

        const result = await useCase.execute({ projectId: "proj-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({
                total: 1,
                counts: createSeverityCountsFixture({ critical: 1 })
            });
        }
        expect(scan).toHaveBeenCalledWith({
            projectId: "proj-1",
            projectPath: "/repo/proj-1",
            packageManager: "yarn"
        });
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = createUseCase(createVulnerabilityServiceStub());

        const result = await useCase.execute({ projectId: "missing" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "PROJECT_NOT_FOUND",
                statusCode: 404,
                message: "Project not found"
            });
        }
    });

    it("returns a 422 error when the project has no detected package manager", async () => {
        const { useCase, db } = createUseCase(createVulnerabilityServiceStub());
        await insertTestProject(db, "proj-1", { packageManager: null });

        const result = await useCase.execute({ projectId: "proj-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({
                code: "NO_PACKAGE_MANAGER",
                statusCode: 422,
                message: "Project has no detected package manager. Run a dependency scan first."
            });
        }
    });

    it("returns a 500 error when the scan throws", async () => {
        const scan = vi.fn(async () => {
            throw new Error("boom");
        });
        const { useCase, db } = createUseCase(createVulnerabilityServiceStub({ scan }));
        await insertTestProject(db, "proj-1", { packageManager: "yarn" });

        const result = await useCase.execute({ projectId: "proj-1" });

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
