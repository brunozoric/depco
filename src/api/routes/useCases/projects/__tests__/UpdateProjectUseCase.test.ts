import { describe, it, expect } from "vitest";
import { generateId } from "@webiny/stdlib";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects } from "#api/db/schema.js";
import { UpdateProjectUseCase, ProjectsUseCasesFeature } from "../index.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function setup() {
    const { container, db } = createTestApiContainer();
    ProjectsUseCasesFeature.register(container);
    const useCase = container.resolve(UpdateProjectUseCase);
    return { useCase, db };
}

function insertProject(db: TestDb, overrides: Partial<typeof projects.$inferInsert> = {}): string {
    const id = overrides.id ?? generateId();
    db.insert(projects)
        .values({
            id,
            name: "original-name",
            path: `/tmp/${id}`,
            packageManager: "yarn",
            pmVersion: "4.0.0",
            addedAt: Date.now(),
            ...overrides
        })
        .run();
    return id;
}

describe("UpdateProjectUseCase", () => {
    it("renames a project and returns the updated data", async () => {
        const { useCase, db } = setup();
        const id = insertProject(db, { name: "old-name" });

        const result = await useCase.execute({ id, name: "new-name" });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.name).toBe("new-name");

        const row = db.select().from(projects).where(eq(projects.id, id)).get();
        expect(row?.name).toBe("new-name");
    });

    it("trims whitespace from the name", async () => {
        const { useCase, db } = setup();
        const id = insertProject(db);

        const result = await useCase.execute({ id, name: "  trimmed  " });

        expect(result.isOk()).toBe(true);
        if (!result.isOk()) {
            return;
        }
        expect(result.value.name).toBe("trimmed");
    });

    it("returns PROJECT_NOT_FOUND for a non-existent project", async () => {
        const { useCase } = setup();

        const result = await useCase.execute({ id: "non-existent", name: "anything" });

        expect(result.isOk()).toBe(false);
        if (result.isOk()) {
            return;
        }
        expect(result.error.code).toBe("PROJECT_NOT_FOUND");
        expect(result.error.statusCode).toBe(404);
    });

    it("returns NAME_ALREADY_EXISTS when another project has the same name", async () => {
        const { useCase, db } = setup();
        insertProject(db, { name: "taken-name" });
        const id = insertProject(db, { name: "my-name" });

        const result = await useCase.execute({ id, name: "taken-name" });

        expect(result.isOk()).toBe(false);
        if (result.isOk()) {
            return;
        }
        expect(result.error.code).toBe("NAME_ALREADY_EXISTS");
        expect(result.error.statusCode).toBe(409);
    });

    it("allows renaming to the same name (no-op)", async () => {
        const { useCase, db } = setup();
        const id = insertProject(db, { name: "same-name" });

        const result = await useCase.execute({ id, name: "same-name" });

        expect(result.isOk()).toBe(true);
    });
});
