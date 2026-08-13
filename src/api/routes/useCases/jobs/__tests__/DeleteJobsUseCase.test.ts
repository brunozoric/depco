import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { upgradeJobs } from "#api/db/schema.js";
import { JobsUseCasesFeature } from "../feature.js";
import { DeleteJobsUseCase } from "../abstractions/DeleteJobsUseCase.js";
import { closeDatabaseConnection } from "./testDatabaseHelpers.js";

interface ITestContext {
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: DeleteJobsUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    JobsUseCasesFeature.register(container);

    return { db, useCase: container.resolve(DeleteJobsUseCase) };
}

describe("DeleteJobsUseCase", () => {
    it("deletes every job when no filters are given", async () => {
        const { db, useCase } = createContext();
        db.insert(upgradeJobs)
            .values([
                { id: "job-1", referenceId: "project-1", type: "scan", status: "completed" },
                { id: "job-2", referenceId: "project-2", type: "scan", status: "running" }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: 2 });
        }
        expect(db.select().from(upgradeJobs).all()).toEqual([]);
    });

    it("deletes only the jobs matching the given filters", async () => {
        const { db, useCase } = createContext();
        db.insert(upgradeJobs)
            .values([
                { id: "job-1", referenceId: "project-1", type: "scan", status: "completed" },
                { id: "job-2", referenceId: "project-1", type: "scan", status: "running" },
                { id: "job-3", referenceId: "project-2", type: "scan", status: "completed" }
            ])
            .run();

        const result = await useCase.execute({ status: "completed", referenceId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: 1 });
        }
        const remaining = db
            .select()
            .from(upgradeJobs)
            .all()
            .map(job => job.id);
        expect(remaining.sort()).toEqual(["job-2", "job-3"]);
    });

    it("returns zero deleted when no jobs match", async () => {
        const { db, useCase } = createContext();
        db.insert(upgradeJobs)
            .values({ id: "job-1", referenceId: "project-1", type: "scan", status: "completed" })
            .run();

        const result = await useCase.execute({ status: "running" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ deleted: 0 });
        }
        expect(db.select().from(upgradeJobs).where(eq(upgradeJobs.id, "job-1")).all()).toHaveLength(
            1
        );
    });

    it("fails with 500 when the database is unavailable", async () => {
        const { db, useCase } = createContext();
        closeDatabaseConnection(db);

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        if (result.isFail()) {
            expect(result.error.statusCode).toBe(500);
            expect(result.error.message).toBeTruthy();
        }
    });
});
