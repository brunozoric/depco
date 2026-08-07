import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { seedYarnSecuritySettings } from "#testing/helpers/seedYarnSecuritySettings.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { SecurityService as SecurityServiceReg } from "../../SecurityService.js";
import { PackageManagerService as PackageManagerServiceReg } from "../../PackageManagerService.js";
import { AuditParserService as AuditParserServiceReg } from "../../AuditParserService.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../PackageManager/PackageManagerDriverRegistry.js";
import { projects } from "#api/db/schema.js";
import { CloneJobExecutor } from "../abstractions/CloneJobExecutor.js";
import { CloneJobExecutor as CloneJobExecutorRegistration } from "../CloneJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

describe("CloneJobExecutor", () => {
    let testDir: string;
    let cloneTarget: string;
    let executor: CloneJobExecutor.Interface;
    let db: Awaited<ReturnType<typeof createTestDb>>;
    let commandRunnerMock: CommandRunner.Interface;
    let container: ReturnType<typeof createContainer>;

    beforeEach(async () => {
        testDir = join(tmpdir(), `clone-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        cloneTarget = join(testDir, "my-repo");
        mkdirSync(testDir, { recursive: true });

        db = await createTestDb();
        await seedYarnSecuritySettings(db);

        commandRunnerMock = {
            run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
            runStreaming: vi.fn(async (_command, _args, options) => {
                // Simulate git clone by creating the target dir with package.json + yarn.lock
                mkdirSync(cloneTarget, { recursive: true });
                writeFileSync(
                    join(cloneTarget, "package.json"),
                    JSON.stringify({ name: "my-repo" })
                );
                writeFileSync(join(cloneTarget, "yarn.lock"), "");
                options.onStdout("Cloning into 'my-repo'...");
                return { stdout: "", stderr: "", exitCode: 0 };
            })
        };

        container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(CommandRunner, commandRunnerMock);
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.register(AuditParserServiceReg).inSingletonScope();
        container.register(PackageManagerServiceReg).inSingletonScope();
        container.register(SecurityServiceReg).inSingletonScope();
        container.register(CloneJobExecutorRegistration);

        executor = container.resolve(CloneJobExecutor);
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    function makeContext(
        overrides?: Partial<JobExecutor.ExecutionContext>
    ): JobExecutor.ExecutionContext {
        return {
            jobId: "job-1",
            referenceId: "clone-project",
            projectPath: testDir,
            packageManager: "yarn",
            packagesJson: JSON.stringify({
                url: "https://github.com/org/my-repo.git",
                destination: cloneTarget
            }),
            project: null,
            appendLog: vi.fn(),
            setProgress: vi.fn(),
            signal: new AbortController().signal,
            ...overrides
        };
    }

    it("runs git clone with correct args", async () => {
        await executor.execute(makeContext());

        expect(commandRunnerMock.runStreaming).toHaveBeenCalledWith(
            "git",
            ["clone", "--", "https://github.com/org/my-repo.git", cloneTarget],
            expect.objectContaining({ cwd: expect.any(String) })
        );
    });

    it("registers the project in the database after clone", async () => {
        await executor.execute(makeContext());

        const allProjects = await db.select().from(projects).all();
        expect(allProjects).toHaveLength(1);
        expect(allProjects[0]!.path).toBe(cloneTarget);
        expect(allProjects[0]!.name).toBe("my-repo");
        expect(allProjects[0]!.packageManager).toBe("yarn");
    });

    it("fails when git clone fails", async () => {
        commandRunnerMock.runStreaming = vi.fn(async () => {
            throw new Error("fatal: repository not found");
        });

        await expect(executor.execute(makeContext())).rejects.toThrow(
            "fatal: repository not found"
        );
    });
});
