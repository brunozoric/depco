import { vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Logger } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import {
    seedYarnSecuritySettings,
    VALID_YARNRC
} from "#testing/helpers/seedYarnSecuritySettings.js";
import { projects } from "#api/db/schema.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { JobWorker } from "../abstractions/JobWorker.js";
import { LockfileParserService } from "../../DependencyGraph/index.js";
import { ErrorReporter } from "../../ErrorReporter/index.js";
import { ScanSchedulerService } from "../../ScanScheduler/index.js";

export type TestDb = ReturnType<typeof createTestApiContainer>["db"];

export interface JobWorkerTestContext {
    testDir: string;
    worker: JobWorker.Interface;
    commandRunner: CommandRunner.Interface;
    broadcaster: WebSocketBroadcaster.Interface;
    logger: Logger.Interface;
    db: TestDb;
}

export function createMockCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
        runStreaming: vi.fn(async (_command, _args, options) => {
            options.onStdout("Processing...");
            return { stdout: "", stderr: "", exitCode: 0 };
        })
    };
}

// CommandRunner double that can also drive a scan: resolves workspace
// listing, installed-version collection, and registry lookups so
// ScanService produces a real (non-empty) result set.
export function createScanCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async (_command: string, args: string[]) => {
            if (args[0] === "workspaces") {
                return { stdout: '{"location":"."}\n', stderr: "", exitCode: 0 };
            }
            if (args[0] === "info" && args[1] === "--all") {
                return {
                    stdout: '{"value":"left-pad@npm:1.3.0","children":{"Version":"1.3.0"}}\n',
                    stderr: "",
                    exitCode: 0
                };
            }
            if (args[0] === "npm" && args[1] === "info") {
                return {
                    stdout: JSON.stringify({
                        "dist-tags": { latest: "1.4.0" },
                        versions: ["1.3.0", "1.4.0"],
                        time: {
                            "1.3.0": "2020-01-01T00:00:00.000Z",
                            "1.4.0": "2020-06-01T00:00:00.000Z"
                        },
                        repository: {
                            type: "git",
                            url: "git+https://github.com/left-pad/left-pad.git"
                        },
                        readme: "# left-pad"
                    }),
                    stderr: "",
                    exitCode: 0
                };
            }
            return { stdout: "", stderr: "", exitCode: 0 };
        }),
        runStreaming: vi.fn(async (_command, _args, options) => {
            options.onStdout("Processing...");
            return { stdout: "", stderr: "", exitCode: 0 };
        })
    };
}

export interface CreateProjectParams {
    db: TestDb;
    id: string;
    path: string;
}

export async function createProject({ db, id, path }: CreateProjectParams): Promise<void> {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, ".yarnrc.yml"), VALID_YARNRC);
    await db
        .insert(projects)
        .values({ id, name: id, path, packageManager: "yarn", addedAt: Date.now() })
        .run();
}

export async function setupJobWorkerTest(): Promise<JobWorkerTestContext> {
    const testDir = join(tmpdir(), `worker-test-${Date.now()}-${Math.random()}`);

    const { container, db } = createTestApiContainer();

    const commandRunner = createMockCommandRunner();
    container.registerInstance(CommandRunner, commandRunner);
    container.registerInstance(LockfileParserService, {
        parse: vi.fn(async () => [
            {
                parentPackage: null,
                parentVersion: null,
                childPackage: "left-pad",
                childVersion: "1.3.0",
                dependencyType: "dependency",
                depth: 0
            }
        ])
    });
    container.registerInstance(ErrorReporter, {
        reportJobFailure: vi.fn(),
        reportJobWarning: vi.fn(),
        reportStepFailure: vi.fn()
    });
    container.registerInstance(ScanSchedulerService, {
        init: vi.fn(),
        stop: vi.fn(),
        scheduleProject: vi.fn(),
        unscheduleProject: vi.fn(),
        onGlobalDefaultChanged: vi.fn(),
        onScanComplete: vi.fn()
    });

    await seedYarnSecuritySettings(db);
    await createProject({ db, id: "p1", path: join(testDir, "p1") });

    const worker = container.resolve(JobWorker);
    const broadcaster = container.resolve(WebSocketBroadcaster);
    const logger = container.resolve(Logger);

    return { testDir, worker, commandRunner, broadcaster, logger, db };
}

export function teardownJobWorkerTest(context: JobWorkerTestContext): void {
    rmSync(context.testDir, { recursive: true, force: true });
}
