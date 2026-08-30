import { describe, it, expect, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { SecurityService } from "#api/services/Security/index.js";
import { CheckProjectSecurityUseCase, ProjectsUseCasesFeature } from "../index.js";

function setup(checkResult: SecurityService.CheckResult) {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const securityService: SecurityService.Interface = {
        check: vi.fn(async () => checkResult),
        getLatest: vi.fn(async () => null),
        getLatestForProjects: vi.fn(async () => new Map())
    };
    container.registerInstance(SecurityService, securityService);
    const useCase = container.resolve(CheckProjectSecurityUseCase);
    return { useCase, db, securityService };
}

describe("CheckProjectSecurityUseCase", () => {
    it("runs a fresh security check against the project's path", async () => {
        const checkResult: SecurityService.CheckResult = {
            passes: true,
            checks: { enableScripts: true }
        };
        const { useCase, db, securityService } = setup(checkResult);
        const id = generateId();
        db.insert(projects)
            .values({
                id,
                name: "p",
                path: "/tmp/my-project-path",
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
        expect(securityService.check).toHaveBeenCalledWith(id, "/tmp/my-project-path");
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = setup({ passes: true, checks: {} });

        const result = await useCase.execute({ id: "unknown" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(404);
        }
    });
});
