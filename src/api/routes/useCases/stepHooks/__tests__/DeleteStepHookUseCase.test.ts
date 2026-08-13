import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { StepHooksUseCasesFeature } from "../feature.js";
import { DeleteStepHookUseCase } from "../abstractions/DeleteStepHookUseCase.js";
import { closeDatabaseConnection } from "./testDatabaseHelpers.js";

interface ITestContext {
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: DeleteStepHookUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    StepHooksUseCasesFeature.register(container);

    return { db, useCase: container.resolve(DeleteStepHookUseCase) };
}

function seedProjectAndHook(db: ITestContext["db"]): void {
    const now = Date.now();
    db.insert(projects).values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: now }).run();
    db.insert(projectStepHooks)
        .values({
            id: "hook-1",
            projectId: "project-1",
            position: "pre-upgrade",
            name: "Run lint",
            command: "yarn lint",
            type: "command",
            createdAt: now,
            updatedAt: now
        })
        .run();
}

describe("DeleteStepHookUseCase", () => {
    it("deletes the step hook when it belongs to the given project", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);

        const result = await useCase.execute({ projectId: "project-1", hookId: "hook-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: true });
        }
        expect(
            db.select().from(projectStepHooks).where(eq(projectStepHooks.id, "hook-1")).all()
        ).toEqual([]);
    });

    it("fails with 404 when the hook does not exist", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);

        const result = await useCase.execute({ projectId: "project-1", hookId: "missing-hook" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Step hook not found" });
    });

    it("fails with 404 when the hook belongs to a different project", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);

        const result = await useCase.execute({ projectId: "other-project", hookId: "hook-1" });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Step hook not found" });
        expect(
            db.select().from(projectStepHooks).where(eq(projectStepHooks.id, "hook-1")).all()
        ).toHaveLength(1);
    });

    it("fails with 500 when the database is unavailable", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);
        closeDatabaseConnection(db);

        const result = await useCase.execute({ projectId: "project-1", hookId: "hook-1" });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(500);
            expect(result.error.message).toBeTruthy();
        }
    });
});
