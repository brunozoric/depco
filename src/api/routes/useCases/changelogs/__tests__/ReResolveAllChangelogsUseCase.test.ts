import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { ChangelogsUseCasesFeature } from "../feature.js";
import { ReResolveAllChangelogsUseCase } from "../abstractions/ReResolveAllChangelogsUseCase.js";

interface ICreateContextOptions {
    changelogService?: Partial<ChangelogService.Interface>;
    jobWorker?: Partial<JobWorker.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ReResolveAllChangelogsUseCase.Interface;
}

function createChangelogServiceStub(
    overrides?: Partial<ChangelogService.Interface>
): ChangelogService.Interface {
    return {
        resolve: vi.fn(async () => {}),
        resetFailed: vi.fn(async () => {}),
        resetAllFailed: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        getChangelogs: vi.fn(async () => []),
        getStats: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        ...overrides
    };
}

function createJobWorkerStub(overrides?: Partial<JobWorker.Interface>): JobWorker.Interface {
    return {
        enqueue: vi.fn(async () => "job-stub"),
        getJob: vi.fn(async () => null),
        getJobsForReference: vi.fn(async () => []),
        processNextJob: vi.fn(async () => {}),
        cancelJob: vi.fn(async () => {}),
        listAllJobs: vi.fn(async () => []),
        drain: vi.fn(async () => {}),
        recoverStaleJobs: vi.fn(async () => {}),
        waitForJob: vi.fn(async () => {
            throw new Error("not implemented in stub");
        }),
        waitForJobs: vi.fn(async () => []),
        getRunningJobsForReference: vi.fn(async () => []),
        ...overrides
    };
}

function createContext(options: ICreateContextOptions = {}): ITestContext {
    const { container } = createTestApiContainer();
    ChangelogsUseCasesFeature.register(container);
    container.registerInstance(
        ChangelogService,
        createChangelogServiceStub(options.changelogService)
    );
    container.registerInstance(JobWorker, createJobWorkerStub(options.jobWorker));

    return { container, useCase: container.resolve(ReResolveAllChangelogsUseCase) };
}

describe("ReResolveAllChangelogsUseCase", () => {
    it("returns a zero package count and enqueues nothing when there are no failed packages", async () => {
        const resetAllFailed = vi.fn(async () => []);
        const enqueue = vi.fn(async () => "job-stub");
        const { useCase } = createContext({
            changelogService: { resetAllFailed },
            jobWorker: { enqueue }
        });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ packageCount: 0 });
        expect(enqueue).not.toHaveBeenCalled();
    });

    it("re-enqueues resolution for every failed package", async () => {
        const resetAllFailed = vi.fn(async () => [
            { packageName: "left-pad", minVersion: "1.0.0", maxVersion: "1.2.0" },
            { packageName: "chalk", minVersion: "2.0.0", maxVersion: "2.4.0" }
        ]);
        const enqueue = vi.fn(async () => "job-stub");
        const { useCase } = createContext({
            changelogService: { resetAllFailed },
            jobWorker: { enqueue }
        });

        const result = await useCase.execute({});

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ packageCount: 2 });
        expect(enqueue).toHaveBeenCalledTimes(2);
        expect(enqueue).toHaveBeenCalledWith(
            expect.objectContaining({ referenceId: "left-pad", type: "changelog" })
        );
        expect(enqueue).toHaveBeenCalledWith(
            expect.objectContaining({ referenceId: "chalk", type: "changelog" })
        );
    });

    it("fails with 500 when resetting failed packages throws", async () => {
        const resetAllFailed = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ changelogService: { resetAllFailed } });

        const result = await useCase.execute({});

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "db unavailable" });
    });
});
