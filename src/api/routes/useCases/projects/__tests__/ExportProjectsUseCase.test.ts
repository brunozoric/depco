import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { ExportProjectsUseCase, ProjectsUseCasesFeature } from "../index.js";

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(ExportProjectsUseCase);
    return { useCase, db };
}

describe("ExportProjectsUseCase", () => {
    it("exports the paths of all registered projects", async () => {
        const { useCase, db } = setup();
        db.insert(projects)
            .values([
                {
                    id: generateId(),
                    name: "a",
                    path: "/tmp/a",
                    packageManager: "yarn",
                    pmVersion: "4.0.0",
                    addedAt: Date.now()
                },
                {
                    id: generateId(),
                    name: "b",
                    path: "/tmp/b",
                    packageManager: "npm",
                    pmVersion: "10.0.0",
                    addedAt: Date.now()
                }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
            expect(result.value.items.map(item => item.path).sort()).toEqual(["/tmp/a", "/tmp/b"]);
        }
    });

    it("returns an empty export when there are no projects", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ items: [], total: 0 });
        }
    });
});
