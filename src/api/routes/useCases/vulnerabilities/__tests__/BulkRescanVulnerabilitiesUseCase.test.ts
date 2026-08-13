import { describe, it, expect, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import { BulkRescanVulnerabilitiesUseCase } from "../abstractions/BulkRescanVulnerabilitiesUseCase.js";
import {
    createVulnerabilityServiceStub,
    createSeverityCountsFixture,
    insertTestProject,
    type TestDb
} from "./vulnerabilitiesUseCasesTestHelpers.js";

function createUseCase(vulnerabilityService: VulnerabilityService.Interface): {
    useCase: BulkRescanVulnerabilitiesUseCase.Interface;
    db: TestDb;
} {
    const { container, db } = createTestApiContainer();
    container.registerInstance(VulnerabilityService, vulnerabilityService);
    return { useCase: container.resolve(BulkRescanVulnerabilitiesUseCase), db };
}

describe("BulkRescanVulnerabilitiesUseCase", () => {
    it("rescans every affected project that has a detected package manager", async () => {
        const getProjectIdsForVulnerabilityIds = vi.fn(async () => ["proj-1", "proj-2"]);
        const scan = vi.fn(async () => ({
            vulnerabilities: [],
            counts: createSeverityCountsFixture(),
            total: 0
        }));
        const { useCase, db } = createUseCase(
            createVulnerabilityServiceStub({ getProjectIdsForVulnerabilityIds, scan })
        );
        await insertTestProject(db, "proj-1", { packageManager: "yarn" });
        await insertTestProject(db, "proj-2", { packageManager: "yarn" });

        const result = await useCase.execute({ ids: ["v1", "v2"] });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ projectsQueued: 2 });
        }
        expect(scan).toHaveBeenCalledTimes(2);
        expect(scan).toHaveBeenNthCalledWith(1, {
            projectId: "proj-1",
            projectPath: "/repo/proj-1",
            packageManager: "yarn"
        });
        expect(scan).toHaveBeenNthCalledWith(2, {
            projectId: "proj-2",
            projectPath: "/repo/proj-2",
            packageManager: "yarn"
        });
    });

    it("skips projects that have no detected package manager", async () => {
        const getProjectIdsForVulnerabilityIds = vi.fn(async () => ["proj-1", "proj-2"]);
        const scan = vi.fn(async () => ({
            vulnerabilities: [],
            counts: createSeverityCountsFixture(),
            total: 0
        }));
        const { useCase, db } = createUseCase(
            createVulnerabilityServiceStub({ getProjectIdsForVulnerabilityIds, scan })
        );
        await insertTestProject(db, "proj-1", { packageManager: null });
        await insertTestProject(db, "proj-2", { packageManager: "yarn" });

        const result = await useCase.execute({ ids: ["v1", "v2"] });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ projectsQueued: 1 });
        }
        expect(scan).toHaveBeenCalledTimes(1);
        expect(scan).toHaveBeenCalledWith({
            projectId: "proj-2",
            projectPath: "/repo/proj-2",
            packageManager: "yarn"
        });
    });

    it("returns a 500 error when resolving affected project ids throws", async () => {
        const getProjectIdsForVulnerabilityIds = vi.fn(async () => {
            throw new Error("boom");
        });
        const { useCase } = createUseCase(
            createVulnerabilityServiceStub({ getProjectIdsForVulnerabilityIds })
        );

        const result = await useCase.execute({ ids: ["v1"] });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error).toEqual({ statusCode: 500, message: "boom" });
        }
    });
});
