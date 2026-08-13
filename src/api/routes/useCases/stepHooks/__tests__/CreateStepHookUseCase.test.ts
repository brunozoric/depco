import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { StepHooksUseCasesFeature } from "../feature.js";
import { CreateStepHookUseCase } from "../abstractions/CreateStepHookUseCase.js";

interface ITestContext {
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: CreateStepHookUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    StepHooksUseCasesFeature.register(container);

    return { db, useCase: container.resolve(CreateStepHookUseCase) };
}

describe("CreateStepHookUseCase", () => {
    it("creates a step hook for an existing project", async () => {
        const { db, useCase } = createContext();
        db.insert(projects)
            .values({ id: "project-1", name: "p", path: "/tmp/p", addedAt: Date.now() })
            .run();

        const result = await useCase.execute({
            projectId: "project-1",
            position: "pre-upgrade",
            name: "Run lint",
            command: "yarn lint",
            type: "command",
            required: true
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.id).toBeTruthy();
            expect(result.value.projectId).toBe("project-1");
            expect(result.value.position).toBe("pre-upgrade");
            expect(result.value.name).toBe("Run lint");
            expect(result.value.command).toBe("yarn lint");
            expect(result.value.type).toBe("command");
            expect(result.value.required).toBe(true);
            expect(result.value.enabled).toBe(true);
            expect(result.value.sortOrder).toBe(0);
            expect(result.value.source).toBe("db");
            expect(typeof result.value.createdAt).toBe("number");
            expect(typeof result.value.updatedAt).toBe("number");
        }

        const rows = db
            .select()
            .from(projectStepHooks)
            .where(eq(projectStepHooks.projectId, "project-1"))
            .all();
        expect(rows).toHaveLength(1);
    });

    it("fails with 500 when the project does not exist (foreign key violation)", async () => {
        const { useCase } = createContext();

        const result = await useCase.execute({
            projectId: "missing-project",
            position: "pre-upgrade",
            name: "Run lint",
            command: "yarn lint",
            type: "command",
            required: false
        });

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(500);
            expect(result.error.message).toBeTruthy();
        }
    });
});
