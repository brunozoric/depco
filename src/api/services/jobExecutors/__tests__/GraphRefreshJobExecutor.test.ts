import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { DependencyGraphService } from "../../abstractions/DependencyGraphService.js";
import { GraphRefreshJobExecutor } from "../abstractions/GraphRefreshJobExecutor.js";
import { GraphRefreshJobExecutor as GraphRefreshJobExecutorRegistration } from "../GraphRefreshJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

function createStubDependencyGraphService(edgeCount: number = 0): DependencyGraphService.Interface {
    return {
        refreshGraph: vi.fn(async () => edgeCount),
        getGraph: vi.fn(async () => ({
            edges: [],
            rootPackages: [],
            totalPackages: 0,
            maxDepth: 0,
            edgeCount: 0
        })),
        findPaths: vi.fn(async () => []),
        searchPackages: vi.fn(async () => [])
    };
}

describe("GraphRefreshJobExecutor", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `graph-refresh-job-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    function createExecutor(
        dependencyGraphService: DependencyGraphService.Interface = createStubDependencyGraphService()
    ): GraphRefreshJobExecutor.Interface {
        const container = createContainer();
        container.registerInstance(DependencyGraphService, dependencyGraphService);
        container.register(GraphRefreshJobExecutorRegistration);
        return container.resolve(GraphRefreshJobExecutor);
    }

    function makeContext(
        overrides?: Partial<JobExecutor.ExecutionContext>
    ): JobExecutor.ExecutionContext {
        return {
            jobId: "job-1",
            referenceId: "project-1",
            projectPath: testDir,
            packageManager: "yarn",
            packagesJson: "{}",
            project: null,
            appendLog: vi.fn(),
            setProgress: vi.fn(),
            signal: new AbortController().signal,
            ...overrides
        };
    }

    it("calls DependencyGraphService.refreshGraph with projectId, projectPath, and packageManager", async () => {
        const dependencyGraphService = createStubDependencyGraphService(42);
        const executor = createExecutor(dependencyGraphService);
        const context = makeContext();

        await executor.execute(context);

        expect(dependencyGraphService.refreshGraph).toHaveBeenCalledWith(
            "project-1",
            testDir,
            "yarn"
        );
    });

    it("logs the edge count via appendLog", async () => {
        const dependencyGraphService = createStubDependencyGraphService(42);
        const executor = createExecutor(dependencyGraphService);
        const appendLogSpy = vi.fn();
        const context = makeContext({ appendLog: appendLogSpy });

        await executor.execute(context);

        expect(appendLogSpy).toHaveBeenCalledWith(
            expect.stringContaining("Dependency graph refreshed: 42 edges")
        );
    });

    it("sets progress to 100 when complete", async () => {
        const dependencyGraphService = createStubDependencyGraphService(10);
        const executor = createExecutor(dependencyGraphService);
        const setProgressSpy = vi.fn();
        const context = makeContext({ setProgress: setProgressSpy });

        await executor.execute(context);

        expect(setProgressSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                percent: 100,
                label: "Dependency graph refresh complete"
            })
        );
    });

    it("throws and logs when DependencyGraphService.refreshGraph fails", async () => {
        const dependencyGraphService: DependencyGraphService.Interface = {
            ...createStubDependencyGraphService(),
            refreshGraph: vi.fn(async () => {
                throw new Error("Graph parse failed");
            })
        };
        const executor = createExecutor(dependencyGraphService);
        const appendLogSpy = vi.fn();
        const context = makeContext({ appendLog: appendLogSpy });

        await expect(executor.execute(context)).rejects.toThrow("Graph parse failed");

        expect(appendLogSpy).toHaveBeenCalledWith(
            expect.stringContaining("Dependency graph refresh failed")
        );
    });
});
