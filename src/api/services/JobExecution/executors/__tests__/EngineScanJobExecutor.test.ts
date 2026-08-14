import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { EngineService } from "../../../Engine/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { EngineScanJobExecutor } from "../abstractions/EngineScanJobExecutor.js";
import { EngineScanJobExecutor as EngineScanJobExecutorRegistration } from "../EngineScanJobExecutor.js";
import { projects } from "#api/db/schema.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";
import type { IEngineStatusCounts } from "#shared/engines/types.js";

const DEFAULT_COUNTS: IEngineStatusCounts = {
    eol: 1,
    maintenance: 2,
    activeLts: 3,
    current: 4,
    unknown: 0
};

function createStubEngineService(
    result: EngineService.ScanResult = {
        rootStatus: "current",
        rootEnginesNode: ">=20",
        findings: [],
        summary: {
            totalProjects: 1,
            counts: DEFAULT_COUNTS,
            projectSummaries: [],
            staleProjectCount: 0,
            stalenessThresholdMs: 604800000
        }
    }
): EngineService.Interface {
    return {
        scan: vi.fn(async () => result),
        getByProject: vi.fn(async () => []),
        getSummary: vi.fn(async () => result.summary)
    };
}

function createStubWebSocketBroadcaster(): WebSocketBroadcaster.Interface {
    return {
        broadcast: vi.fn(),
        addClient: vi.fn(),
        removeClient: vi.fn(),
        closeConnectionsForUser: vi.fn()
    };
}

interface ICreateExecutorInput {
    engineService?: EngineService.Interface;
    webSocketBroadcaster?: WebSocketBroadcaster.Interface;
}

describe("EngineScanJobExecutor", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(
            tmpdir(),
            `engine-scan-job-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    function createExecutor(input: ICreateExecutorInput = {}): EngineScanJobExecutor.Interface {
        const { container } = createTestApiContainer();

        container.registerInstance(EngineService, input.engineService ?? createStubEngineService());
        container.registerInstance(
            WebSocketBroadcaster,
            input.webSocketBroadcaster ?? createStubWebSocketBroadcaster()
        );

        container.register(EngineScanJobExecutorRegistration);

        return container.resolve(EngineScanJobExecutor);
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

    it("has type 'engine-scan'", () => {
        const executor = createExecutor();
        expect(executor.type).toBe("engine-scan");
    });

    it("calls EngineService.scan() with the projectId and projectPath from the context", async () => {
        const engineService = createStubEngineService();
        const executor = createExecutor({ engineService });

        await executor.execute(makeContext());

        expect(engineService.scan).toHaveBeenCalledWith({
            projectId: "project-1",
            projectPath: testDir,
            warnMaintenance: true
        });
    });

    it("broadcasts engine-scan:complete with the scan summary counts", async () => {
        const engineService = createStubEngineService();
        const webSocketBroadcaster = createStubWebSocketBroadcaster();
        const executor = createExecutor({ engineService, webSocketBroadcaster });

        await executor.execute(makeContext());

        expect(webSocketBroadcaster.broadcast).toHaveBeenCalledWith("engine-scan:complete", {
            projectId: "project-1",
            counts: DEFAULT_COUNTS
        });
    });

    it("logs a summary of the scan via appendLog", async () => {
        const engineService = createStubEngineService();
        const executor = createExecutor({ engineService });
        const appendLog = vi.fn();

        await executor.execute(makeContext({ appendLog }));

        expect(appendLog).toHaveBeenCalledWith(expect.stringContaining("Engine scan complete"));
    });

    it("reports progress from 0 to 100", async () => {
        const engineService = createStubEngineService();
        const executor = createExecutor({ engineService });
        const setProgress = vi.fn();

        await executor.execute(makeContext({ setProgress }));

        expect(setProgress).toHaveBeenCalledWith(expect.objectContaining({ percent: 0 }));
        expect(setProgress).toHaveBeenCalledWith(expect.objectContaining({ percent: 100 }));
    });

    it("updates the project's engineStatus and rootEnginesNode after a successful scan", async () => {
        const { container, db } = createTestApiContainer();
        const projectId = generateId();
        db.insert(projects)
            .values({
                id: projectId,
                name: "test-project",
                path: testDir,
                packageManager: "yarn",
                pmVersion: "4.0.0",
                addedAt: Date.now()
            })
            .run();

        const scanResult: EngineService.ScanResult = {
            rootStatus: "active-lts",
            rootEnginesNode: ">=18",
            findings: [],
            summary: {
                totalProjects: 1,
                counts: {
                    eol: 0,
                    maintenance: 0,
                    activeLts: 1,
                    current: 0,
                    unknown: 0
                },
                projectSummaries: [],
                staleProjectCount: 0,
                stalenessThresholdMs: 604800000
            }
        };

        container.registerInstance(EngineService, createStubEngineService(scanResult));
        container.registerInstance(WebSocketBroadcaster, createStubWebSocketBroadcaster());
        container.register(EngineScanJobExecutorRegistration);
        const executor = container.resolve(EngineScanJobExecutor);

        await executor.execute(makeContext({ referenceId: projectId, projectPath: testDir }));

        const row = db.select().from(projects).where(eq(projects.id, projectId)).get();
        expect(row?.engineStatus).toBe("active-lts");
        expect(row?.rootEnginesNode).toBe(">=18");
    });
});
