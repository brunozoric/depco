import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { StepHooksUseCasesFeature } from "../feature.js";
import { UpdateStepHookUseCase } from "../abstractions/UpdateStepHookUseCase.js";
import { closeDatabaseConnection } from "./testDatabaseHelpers.js";

interface ITestContext {
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: UpdateStepHookUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    StepHooksUseCasesFeature.register(container);

    return { db, useCase: container.resolve(UpdateStepHookUseCase) };
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
            required: 1,
            enabled: 1,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now
        })
        .run();
}

describe("UpdateStepHookUseCase", () => {
    it("updates only the given fields and keeps the rest unchanged", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);

        const result = await useCase.execute({
            projectId: "project-1",
            hookId: "hook-1",
            name: "Run lint fix",
            command: "yarn lint:fix",
            enabled: false,
            sortOrder: 5
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.name).toBe("Run lint fix");
            expect(result.value.command).toBe("yarn lint:fix");
            expect(result.value.enabled).toBe(false);
            expect(result.value.sortOrder).toBe(5);
            // Untouched fields keep their previous values.
            expect(result.value.position).toBe("pre-upgrade");
            expect(result.value.type).toBe("command");
            expect(result.value.required).toBe(true);
        }
    });

    it("fails with 404 when the hook does not exist", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);

        const result = await useCase.execute({
            projectId: "project-1",
            hookId: "missing-hook",
            name: "Anything"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Step hook not found" });
    });

    it("fails with 404 when the hook belongs to a different project", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);

        const result = await useCase.execute({
            projectId: "other-project",
            hookId: "hook-1",
            name: "Anything"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 404, message: "Step hook not found" });
    });

    it("fails with 500 when the database is unavailable", async () => {
        const { db, useCase } = createContext();
        seedProjectAndHook(db);
        closeDatabaseConnection(db);

        const result = await useCase.execute({
            projectId: "project-1",
            hookId: "hook-1",
            name: "Anything"
        });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(500);
            expect(result.error.message).toBeTruthy();
        }
    });
});
