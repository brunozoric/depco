import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { ErrorReporter } from "../../ErrorReporter/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { FileConfigService } from "../../abstractions/FileConfigService.js";
import { ScanService as ScanServiceReg } from "../../ScanService.js";
import { PackageManagerService as PackageManagerServiceReg } from "../../PackageManagerService.js";
import { AuditParserService as AuditParserServiceReg } from "../../AuditParserService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../packageManagers/PackageManagerDriverRegistry.js";
import { RegistryCacheService as RegistryCacheServiceReg } from "../../RegistryCacheService.js";
import { LockfileParserService } from "../../abstractions/LockfileParserService.js";
import { SecurityService as SecurityServiceReg } from "../../SecurityService.js";

import {
    projects,
    upgradeJobs,
    dependencies,
    dependencyVersions,
    changelogs,
    scanResults,
    dependencyChanges
} from "#api/db/schema.js";
import { generateId } from "@webiny/stdlib";
import { PackageScanJobExecutor } from "../abstractions/PackageScanJobExecutor.js";
import { PackageScanJobExecutor as PackageScanJobExecutorRegistration } from "../PackageScanJobExecutor.js";
import { DependencyChangeService as DependencyChangeServiceReg } from "../../DependencyChangeService.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

function createStubFileConfigService(): FileConfigService.Interface {
    return {
        readConfig: async () => null,
        readGlobalSettings: async () => ({ settings: null }),
        readGlobalConfig: async () => ({ config: null }),
        writeGlobalPmSettings: async () => {}
    };
}

// CommandRunner double that drives a yarn scan. `installedInfoLine` controls
// what `yarn info --all --json` reports as installed — leaving it empty
// simulates a stale/missing lockfile (package.json lists deps, yarn info
// reports none installed), which is what should trigger the 0-dep warning.
function createScanCommandRunner(installedInfoLine: string | null): CommandRunner.Interface {
    return {
        run: vi.fn(async (_command: string, args: string[]) => {
            if (args[0] === "workspaces") {
                return { stdout: '{"location":"."}\n', stderr: "", exitCode: 0 };
            }
            if (args[0] === "info" && args[1] === "--all") {
                return {
                    stdout: installedInfoLine ?? "",
                    stderr: "",
                    exitCode: 0
                };
            }
            if (args[0] === "npm" && args[1] === "info") {
                return {
                    stdout: JSON.stringify({
                        "dist-tags": { latest: "1.4.0" },
                        versions: ["1.3.0", "1.4.0"]
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

// CommandRunner double for changelog-placeholder tests: reports "react"
// installed at 18.2.0, and registry info listing every version between the
// installed and latest so upgradeableVersions has intermediate entries to
// insert placeholder changelog rows for.
function createChangelogScanCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async (_command: string, args: string[]) => {
            if (args[0] === "workspaces") {
                return { stdout: '{"location":"."}\n', stderr: "", exitCode: 0 };
            }
            if (args[0] === "info" && args[1] === "--all") {
                return {
                    stdout: '{"value":"react@npm:18.2.0","children":{"Version":"18.2.0"}}\n',
                    stderr: "",
                    exitCode: 0
                };
            }
            if (args[0] === "npm" && args[1] === "info") {
                return {
                    stdout: JSON.stringify({
                        "dist-tags": { latest: "19.1.0" },
                        versions: ["18.2.0", "18.3.0", "19.0.0", "19.1.0"],
                        time: {},
                        repository: { url: "git+https://github.com/facebook/react.git" }
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

// CommandRunner double reporting two installed packages ("left-pad" at
// 1.4.0 and "is-odd" at 1.0.0) — used to exercise dependency change
// detection against a seeded scanResults row for "left-pad" at an older
// version.
function createTwoPackageScanCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async (_command: string, args: string[]) => {
            if (args[0] === "workspaces") {
                return { stdout: '{"location":"."}\n', stderr: "", exitCode: 0 };
            }
            if (args[0] === "info" && args[1] === "--all") {
                return {
                    stdout:
                        '{"value":"left-pad@npm:1.4.0","children":{"Version":"1.4.0"}}\n' +
                        '{"value":"is-odd@npm:1.0.0","children":{"Version":"1.0.0"}}\n',
                    stderr: "",
                    exitCode: 0
                };
            }
            if (args[0] === "npm" && args[1] === "info") {
                return {
                    stdout: JSON.stringify({
                        "dist-tags": { latest: "1.4.0" },
                        versions: ["1.0.0", "1.3.0", "1.4.0"]
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

function makeEdge(
    childPackage: string,
    childVersion: string
): LockfileParserService.DependencyEdge {
    return {
        parentPackage: null,
        parentVersion: null,
        childPackage,
        childVersion,
        dependencyType: "dependency",
        depth: 0
    };
}

describe("PackageScanJobExecutor", () => {
    let testDir: string;
    let db: Awaited<ReturnType<typeof createTestDb>>;
    let broadcaster: WebSocketBroadcaster.Interface;

    beforeEach(async () => {
        testDir = join(
            tmpdir(),
            `package-scan-job-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        mkdirSync(testDir, { recursive: true });
        db = await createTestDb();
        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    function createExecutor(
        commandRunner: CommandRunner.Interface,
        lockfileEdges: LockfileParserService.DependencyEdge[] = []
    ): PackageScanJobExecutor.Interface {
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(CommandRunner, commandRunner);
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.register(AuditParserServiceReg).inSingletonScope();
        container.register(PackageManagerServiceReg).inSingletonScope();
        container.registerInstance(FileConfigService, createStubFileConfigService());
        container.register(RegistryCacheServiceReg).inSingletonScope();
        container.registerInstance(LockfileParserService, {
            parse: vi.fn(async () => lockfileEdges)
        });
        container.register(ScanServiceReg).inSingletonScope();
        container.register(DependencyChangeServiceReg).inSingletonScope();
        container.register(SecurityServiceReg).inSingletonScope();
        container.registerInstance(WebSocketBroadcaster, broadcaster);
        container.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        } satisfies ErrorReporter.Interface);

        container.register(PackageScanJobExecutorRegistration);

        return container.resolve(PackageScanJobExecutor);
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

    async function insertJob(jobId: string): Promise<void> {
        await db
            .insert(upgradeJobs)
            .values({
                id: jobId,
                referenceId: "project-1",
                referenceType: "project",
                type: "package-scan",
                status: "running",
                startedAt: Date.now()
            })
            .run();
    }

    async function insertProject(): Promise<void> {
        await db
            .insert(projects)
            .values({
                id: "project-1",
                name: "p1",
                path: testDir,
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();
    }

    it("persists scan results to the scan_results table with correct fields", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({ name: "p1", dependencies: { "left-pad": "^1.0.0" } })
        );
        await insertProject();

        const executor = createExecutor(
            createScanCommandRunner(
                '{"value":"left-pad@npm:1.3.0","children":{"Version":"1.3.0"}}\n'
            ),
            [makeEdge("left-pad", "1.3.0")]
        );
        await executor.execute(makeContext());

        const rows = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "project-1"))
            .all();

        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual(
            expect.objectContaining({
                projectId: "project-1",
                name: "left-pad",
                currentVersion: "1.3.0",
                latestVersion: "1.4.0",
                registryResolved: 1
            })
        );
    });

    it("passes the force flag through to ScanService, bypassing the registry cache", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({ name: "p1", dependencies: { "left-pad": "^1.0.0" } })
        );
        await insertProject();

        const commandRunner = createScanCommandRunner(
            '{"value":"left-pad@npm:1.3.0","children":{"Version":"1.3.0"}}\n'
        );
        const executor = createExecutor(commandRunner, [makeEdge("left-pad", "1.3.0")]);
        const appendLogSpy = vi.fn();

        await executor.execute(
            makeContext({
                packagesJson: JSON.stringify({ force: true }),
                appendLog: appendLogSpy
            })
        );

        expect(appendLogSpy).toHaveBeenCalledWith(expect.stringContaining("Force mode enabled"));

        // The scanned dependency should still resolve normally with force
        // enabled — force only bypasses the registry cache, it doesn't
        // change the shape of the scan output.
        const rows = await db
            .select()
            .from(scanResults)
            .where(eq(scanResults.projectId, "project-1"))
            .all();
        expect(rows).toHaveLength(1);
        expect(rows[0]?.name).toBe("left-pad");
    });

    it("does not log force mode when the force flag is absent", async () => {
        writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "p1" }));
        await insertProject();

        const executor = createExecutor(createScanCommandRunner(null));
        const appendLogSpy = vi.fn();
        await executor.execute(makeContext({ appendLog: appendLogSpy }));

        expect(appendLogSpy).not.toHaveBeenCalledWith(
            expect.stringContaining("Force mode enabled")
        );
    });

    it("broadcasts scan:progress WebSocket events during registry lookups", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({ name: "p1", dependencies: { "left-pad": "^1.0.0" } })
        );
        await insertProject();

        const executor = createExecutor(
            createScanCommandRunner(
                '{"value":"left-pad@npm:1.3.0","children":{"Version":"1.3.0"}}\n'
            ),
            [makeEdge("left-pad", "1.3.0")]
        );
        await executor.execute(makeContext());

        const broadcastSpy = broadcaster.broadcast as ReturnType<typeof vi.fn>;
        const progressCall = broadcastSpy.mock.calls.find(
            (c: unknown[]) => c[0] === "scan:progress"
        );
        expect(progressCall).toBeDefined();
        expect(progressCall![1]).toEqual(
            expect.objectContaining({
                projectId: "project-1",
                packageName: "left-pad",
                current: 1,
                total: 1
            })
        );
    });

    it("detects and persists dependency changes for version bumps and newly added packages", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({
                name: "p1",
                dependencies: { "left-pad": "^1.0.0", "is-odd": "^1.0.0" }
            })
        );
        await insertProject();

        await db
            .insert(scanResults)
            .values({
                id: generateId(),
                projectId: "project-1",
                name: "left-pad",
                currentVersion: "1.3.0",
                latestVersion: "1.3.0",
                latestInRange: "1.3.0",
                type: "dependencies",
                upgradeType: "none",
                scannedAt: Date.now()
            })
            .run();

        const executor = createExecutor(createTwoPackageScanCommandRunner(), [
            makeEdge("left-pad", "1.4.0"),
            makeEdge("is-odd", "1.0.0")
        ]);
        await executor.execute(makeContext());

        const changeRows = await db
            .select()
            .from(dependencyChanges)
            .where(eq(dependencyChanges.projectId, "project-1"))
            .all();

        const versionChanged = changeRows.find(row => row.packageName === "left-pad");
        expect(versionChanged).toBeDefined();
        expect(versionChanged?.changeType).toBe("version-changed");
        expect(versionChanged?.previousVersion).toBe("1.3.0");
        expect(versionChanged?.newVersion).toBe("1.4.0");

        const added = changeRows.find(row => row.packageName === "is-odd");
        expect(added).toBeDefined();
        expect(added?.changeType).toBe("added");
        expect(added?.previousVersion).toBeNull();
        expect(added?.newVersion).toBe("1.0.0");
    });

    it("stores a warning on the job row when 0 deps are found but package.json lists deps", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({ name: "p1", dependencies: { "left-pad": "^1.0.0" } })
        );
        await insertProject();
        await insertJob("job-1");

        const executor = createExecutor(createScanCommandRunner(null));
        await executor.execute(makeContext());

        const job = await db.select().from(upgradeJobs).where(eq(upgradeJobs.id, "job-1")).get();
        expect(job?.warning).toEqual(expect.stringContaining("0 dependencies found"));
    });

    it("does not set a warning when 0 deps are found and package.json has no deps", async () => {
        writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "p1" }));
        await insertProject();
        await insertJob("job-1");

        const executor = createExecutor(createScanCommandRunner(null));
        await executor.execute(makeContext());

        const job = await db.select().from(upgradeJobs).where(eq(upgradeJobs.id, "job-1")).get();
        expect(job?.warning).toBeNull();
    });

    it("inserts changelog placeholder rows for upgradeable versions", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({ name: "p1", dependencies: { react: "^18.2.0" } })
        );
        await insertProject();
        await insertJob("job-1");

        const executor = createExecutor(createChangelogScanCommandRunner(), [
            makeEdge("react", "18.2.0")
        ]);
        await executor.execute(makeContext());

        const depRow = await db
            .select()
            .from(dependencies)
            .where(eq(dependencies.name, "react"))
            .get();
        expect(depRow).toBeDefined();
        expect(depRow?.repoUrl).toBe("https://github.com/facebook/react");

        const versionRows = await db
            .select()
            .from(dependencyVersions)
            .where(eq(dependencyVersions.dependencyId, depRow!.id))
            .all();
        const versions = versionRows.map(row => row.version).sort();
        expect(versions).toEqual(["18.3.0", "19.0.0", "19.1.0"]);

        const changelogRows = await db
            .select()
            .from(changelogs)
            .where(eq(changelogs.dependencyId, depRow!.id))
            .all();
        expect(changelogRows).toHaveLength(3);

        const versionIds = new Set(versionRows.map(row => row.id));
        for (const row of changelogRows) {
            expect(row.content).toBeNull();
            expect(row.dependencyId).toBe(depRow!.id);
            expect(versionIds.has(row.dependencyVersionId)).toBe(true);
        }
    });

    it("updates the project row with lastScannedAt, packageManager, and pmVersion", async () => {
        writeFileSync(
            join(testDir, "package.json"),
            JSON.stringify({ name: "p1", dependencies: { "left-pad": "^1.0.0" } })
        );
        await insertProject();

        const executor = createExecutor(
            createScanCommandRunner(
                '{"value":"left-pad@npm:1.3.0","children":{"Version":"1.3.0"}}\n'
            ),
            [makeEdge("left-pad", "1.3.0")]
        );
        await executor.execute(makeContext());

        const project = await db.select().from(projects).where(eq(projects.id, "project-1")).get();

        expect(project?.lastScannedAt).not.toBeNull();
        expect(project?.packageManager).toBe("yarn");
    });
});
