import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { upgradeJobs } from "#api/db/schema.js";
import { JobsUseCasesFeature } from "../feature.js";
import { ListAllJobsUseCase } from "../abstractions/ListAllJobsUseCase.js";
import { closeDatabaseConnection } from "./testDatabaseHelpers.js";

interface ITestContext {
    db: ReturnType<typeof createTestApiContainer>["db"];
    useCase: ListAllJobsUseCase.Interface;
}

function createContext(): ITestContext {
    const { container, db } = createTestApiContainer();
    JobsUseCasesFeature.register(container);

    return { db, useCase: container.resolve(ListAllJobsUseCase) };
}

describe("ListAllJobsUseCase", () => {
    it("returns every job ordered by most recently started first", async () => {
        const { db, useCase } = createContext();
        db.insert(upgradeJobs)
            .values([
                {
                    id: "job-1",
                    referenceId: "project-1",
                    type: "scan",
                    status: "completed",
                    startedAt: 1000
                },
                {
                    id: "job-2",
                    referenceId: "project-1",
                    type: "scan",
                    status: "completed",
                    startedAt: 2000
                }
            ])
            .run();

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(2);
            expect(result.value.items.map(job => job.id)).toEqual(["job-2", "job-1"]);
        }
    });

    it("filters jobs by status, type and reference id", async () => {
        const { db, useCase } = createContext();
        db.insert(upgradeJobs)
            .values([
                {
                    id: "job-1",
                    referenceId: "project-1",
                    type: "scan",
                    status: "completed",
                    startedAt: 1000
                },
                {
                    id: "job-2",
                    referenceId: "project-1",
                    type: "dependency",
                    status: "running",
                    startedAt: 2000
                },
                {
                    id: "job-3",
                    referenceId: "project-2",
                    type: "scan",
                    status: "completed",
                    startedAt: 3000
                }
            ])
            .run();

        const result = await useCase.execute({ status: "completed", referenceId: "project-1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(1);
            expect(result.value.items.map(job => job.id)).toEqual(["job-1"]);
        }
    });

    it("applies limit and offset for pagination", async () => {
        const { db, useCase } = createContext();
        db.insert(upgradeJobs)
            .values([
                {
                    id: "job-1",
                    referenceId: "project-1",
                    type: "scan",
                    status: "completed",
                    startedAt: 1000
                },
                {
                    id: "job-2",
                    referenceId: "project-1",
                    type: "scan",
                    status: "completed",
                    startedAt: 2000
                },
                {
                    id: "job-3",
                    referenceId: "project-1",
                    type: "scan",
                    status: "completed",
                    startedAt: 3000
                }
            ])
            .run();

        const result = await useCase.execute({ limit: "1", offset: "1" });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.total).toBe(3);
            expect(result.value.items.map(job => job.id)).toEqual(["job-2"]);
        }
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
