import { describe, it, expect, vi } from "vitest";
import type { Container } from "@webiny/di";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { ChangelogService } from "#api/services/Changelog/index.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { ChangelogsUseCasesFeature } from "../feature.js";
import { ReResolveChangelogsUseCase } from "../abstractions/ReResolveChangelogsUseCase.js";

interface ICreateContextOptions {
    changelogService?: Partial<ChangelogService.Interface>;
    jobWorker?: Partial<JobWorker.Interface>;
}

interface ITestContext {
    container: Container;
    useCase: ReResolveChangelogsUseCase.Interface;
}

function createChangelogServiceStub(
    overrides?: Partial<ChangelogService.Interface>
): ChangelogService.Interface {
    return {
        resolve: vi.fn(async () => {}),
        resetFailed: vi.fn(async () => {}),
        resetAllFailed: vi.fn(async () => []),
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

    return { container, useCase: container.resolve(ReResolveChangelogsUseCase) };
}

describe("ReResolveChangelogsUseCase", () => {
    it("short-circuits with an empty result when from equals to", async () => {
        const resetFailed = vi.fn(async () => {});
        const { useCase } = createContext({ changelogService: { resetFailed } });

        const result = await useCase.execute({
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.0.0"
        });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ items: [], total: 0, resolving: false });
        expect(resetFailed).not.toHaveBeenCalled();
    });

    it("resets failed rows, re-enqueues resolution, and returns the refreshed entries", async () => {
        const entries = [{ version: "1.1.0", content: null, source: null }];
        const resetFailed = vi.fn(async () => {});
        const getChangelogs = vi.fn(async () => entries);
        const enqueue = vi.fn(async () => "job-stub");
        const { useCase } = createContext({
            changelogService: { resetFailed, getChangelogs },
            jobWorker: { enqueue }
        });

        const result = await useCase.execute({
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.2.0"
        });

        expect(result.isOk()).toBe(true);
        expect(result.value).toEqual({ items: entries, total: 1, resolving: true });
        expect(resetFailed).toHaveBeenCalledWith("left-pad");
        expect(enqueue).toHaveBeenCalledWith(
            expect.objectContaining({ referenceId: "left-pad", type: "changelog" })
        );
    });

    it("fails with 500 when resetting failed rows throws", async () => {
        const resetFailed = vi.fn(async () => {
            throw new Error("db unavailable");
        });
        const { useCase } = createContext({ changelogService: { resetFailed } });

        const result = await useCase.execute({
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.2.0"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "db unavailable" });
    });

    it("fails with 500 when re-fetching the changelogs throws", async () => {
        const getChangelogs = vi.fn(async () => {
            throw new Error("registry unavailable");
        });
        const { useCase } = createContext({ changelogService: { getChangelogs } });

        const result = await useCase.execute({
            packageName: "left-pad",
            from: "1.0.0",
            to: "1.2.0"
        });

        expect(result.isFail()).toBe(true);
        expect(result.error).toEqual({ statusCode: 500, message: "registry unavailable" });
    });
});
