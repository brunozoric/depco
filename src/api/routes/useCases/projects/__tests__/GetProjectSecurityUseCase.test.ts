import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { SecurityService } from "#api/services/Security/index.js";
import { GetProjectSecurityUseCase, ProjectsUseCasesFeature } from "../index.js";

function setup(getLatestResult: SecurityService.CheckResult | null) {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    container.registerInstance(SecurityService, {
        check: vi.fn(async () => ({ passes: true, checks: {} })),
        getLatest: vi.fn(async () => getLatestResult),
        getLatestForProjects: vi.fn(async () => new Map())
    });
    const useCase = container.resolve(GetProjectSecurityUseCase);
    return { useCase, db };
}

describe("GetProjectSecurityUseCase", () => {
    it("returns the latest security check result for the project", async () => {
        const checkResult: SecurityService.CheckResult = {
            passes: false,
            checks: { enableScripts: false }
        };
        const { useCase, db } = setup(checkResult);
        const id = generateId();
        db.insert(projects)
            .values({
                id,
                name: "p",
                path: "/tmp/p",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual(checkResult);
        }
    });

    it("returns null when there is no security check yet", async () => {
        const { useCase, db } = setup(null);
        const id = generateId();
        db.insert(projects)
            .values({
                id,
                name: "p",
                path: "/tmp/p",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBeNull();
        }
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = setup(null);

        const result = await useCase.execute({ id: "unknown" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(404);
        }
    });
});
