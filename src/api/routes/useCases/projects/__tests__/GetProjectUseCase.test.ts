import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { GetProjectUseCase, ProjectsUseCasesFeature } from "../index.js";

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(GetProjectUseCase);
    return { useCase, db };
}

describe("GetProjectUseCase", () => {
    it("returns the project when it exists", async () => {
        const { useCase, db } = setup();
        const id = generateId();
        db.insert(projects)
            .values({
                id,
                name: "my-project",
                path: "/tmp/my-project",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();

        const result = await useCase.execute({ id });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.id).toBe(id);
            expect(result.value.name).toBe("my-project");
            expect(result.value.hasNodeModules).toBe(false);
        }
    });

    it("returns a 404 error when the project does not exist", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ id: "unknown-id" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(404);
            expect(result.error.message).toBe("Project not found");
        }
    });
});
