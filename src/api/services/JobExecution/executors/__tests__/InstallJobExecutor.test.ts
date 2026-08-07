import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, rm } from "fs/promises";
import { join } from "path";
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";
import { DirectoryToolFeature, FileToolFeature, JsonFileToolFeature } from "@webiny/stdlib/node";
import { createContainer } from "#shared/index.js";
import { CommandRunner } from "../../../CommandRunner/index.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../../PackageManager/PackageManagerDriverRegistry.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { FileConfigService as FileConfigServiceRegistration } from "../../../FileConfig/FileConfigService.js";
import { InstallJobExecutor } from "../abstractions/InstallJobExecutor.js";
import { InstallJobExecutor as InstallJobExecutorRegistration } from "../InstallJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";

describe("InstallJobExecutor", () => {
    let broadcaster: WebSocketBroadcaster.Interface;
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        container.registerInstance(ConsoleLoggerConfig, {
            getConfig: () => ({ logLevel: "error" })
        });
        ConsoleLoggerFeature.register(container);
        DirectoryToolFeature.register(container);
        FileToolFeature.register(container);
        JsonFileToolFeature.register(container);
        container.register(FileConfigServiceRegistration).inSingletonScope();
    });

    function createCommandRunner(): CommandRunner.Interface {
        return {
            run: vi.fn(async () => ({ stdout: "10.0.0", stderr: "", exitCode: 0 })),
            runStreaming: vi.fn(async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }))
        };
    }

    function createExecutor(commandRunner: CommandRunner.Interface): InstallJobExecutor.Interface {
        container.registerInstance(CommandRunner, commandRunner);
        container.registerInstance(WebSocketBroadcaster, broadcaster);
        container.register(InstallJobExecutorRegistration);
        return container.resolve(InstallJobExecutor);
    }

    function makeContext(
        overrides?: Partial<JobExecutor.ExecutionContext>
    ): JobExecutor.ExecutionContext {
        return {
            jobId: "job-1",
            referenceId: "project-1",
            projectPath: "/tmp/test-project",
            packageManager: "npm",
            packagesJson: JSON.stringify({ flags: ["--force"] }),
            project: null,
            appendLog: vi.fn(),
            setProgress: vi.fn(),
            signal: new AbortController().signal,
            ...overrides
        };
    }

    it("should have type 'install'", () => {
        const executor = createExecutor(createCommandRunner());
        expect(executor.type).toBe("install");
    });

    it("should validate flags against driver's allowed flags", async () => {
        const executor = createExecutor(createCommandRunner());
        const context = makeContext({
            packagesJson: JSON.stringify({ flags: ["--malicious-flag"] })
        });

        await expect(executor.execute(context)).rejects.toThrow();
    });

    it("should check PM binary exists before running install", async () => {
        const commandRunner = createCommandRunner();
        const executor = createExecutor(commandRunner);

        await executor.execute(makeContext());

        expect(commandRunner.run).toHaveBeenCalledWith(
            "npm",
            ["--version"],
            expect.objectContaining({ cwd: "/tmp/test-project" })
        );
    });

    it("should fail with clear error when PM binary is missing", async () => {
        const commandRunner = createCommandRunner();
        commandRunner.run = vi.fn().mockRejectedValue(new Error("ENOENT"));
        const executor = createExecutor(commandRunner);

        await expect(executor.execute(makeContext())).rejects.toThrow(/not installed/i);
    });

    it("should run install command with validated flags", async () => {
        const commandRunner = createCommandRunner();
        const executor = createExecutor(commandRunner);

        await executor.execute(
            makeContext({ packagesJson: JSON.stringify({ flags: ["--force"] }) })
        );

        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "npm",
            ["install", "--force"],
            expect.objectContaining({ cwd: "/tmp/test-project" })
        );
    });

    it("should broadcast install:complete on success", async () => {
        const executor = createExecutor(createCommandRunner());

        await executor.execute(makeContext());

        expect(broadcaster.broadcast).toHaveBeenCalledWith("install:complete", {
            projectId: "project-1"
        });
    });

    it("should accept empty flags array for plain install", async () => {
        const commandRunner = createCommandRunner();
        const executor = createExecutor(commandRunner);

        await executor.execute(makeContext({ packagesJson: JSON.stringify({ flags: [] }) }));

        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "npm",
            ["install"],
            expect.objectContaining({ cwd: "/tmp/test-project" })
        );
    });

    it("should default to empty flags when packagesJson has no flags field", async () => {
        const commandRunner = createCommandRunner();
        const executor = createExecutor(commandRunner);

        await executor.execute(makeContext({ packagesJson: "{}" }));

        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "npm",
            ["install"],
            expect.objectContaining({ cwd: "/tmp/test-project" })
        );
    });

    it("should reject on unknown package manager", async () => {
        const executor = createExecutor(createCommandRunner());

        await expect(
            executor.execute(makeContext({ packageManager: "does-not-exist" }))
        ).rejects.toThrow(/no driver/i);
    });

    describe("file config install flags", () => {
        const configPath = join(process.cwd(), ".dependency-upgrader.json");

        afterEach(async () => {
            await rm(configPath, { force: true });
        });

        it("uses install flags from file config when present", async () => {
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        pnpm: {
                            installFlags: {
                                "--frozen-lockfile": true,
                                "--ignore-scripts": true
                            }
                        }
                    }
                }),
                "utf-8"
            );

            const commandRunner = createCommandRunner();
            const executor = createExecutor(commandRunner);

            await executor.execute(
                makeContext({
                    packageManager: "pnpm",
                    packagesJson: JSON.stringify({ flags: [] })
                })
            );

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "pnpm",
                expect.arrayContaining(["install", "--frozen-lockfile", "--ignore-scripts"]),
                expect.any(Object)
            );
        });

        it("omits flags set to false in file config", async () => {
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        pnpm: {
                            installFlags: {
                                "--frozen-lockfile": true,
                                "--ignore-scripts": false
                            }
                        }
                    }
                }),
                "utf-8"
            );

            const commandRunner = createCommandRunner();
            const executor = createExecutor(commandRunner);

            await executor.execute(
                makeContext({
                    packageManager: "pnpm",
                    packagesJson: JSON.stringify({ flags: [] })
                })
            );

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "pnpm",
                ["install", "--frozen-lockfile"],
                expect.any(Object)
            );
        });

        it("uses user-selected flags when no file config", async () => {
            const commandRunner = createCommandRunner();
            const executor = createExecutor(commandRunner);

            await executor.execute(
                makeContext({
                    packageManager: "pnpm",
                    packagesJson: JSON.stringify({ flags: ["--force"] })
                })
            );

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "pnpm",
                ["install", "--force"],
                expect.any(Object)
            );
        });

        it("ignores file config for a package manager other than the requested one", async () => {
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        yarn: {
                            installFlags: { "--immutable": true }
                        }
                    }
                }),
                "utf-8"
            );

            const commandRunner = createCommandRunner();
            const executor = createExecutor(commandRunner);

            await executor.execute(
                makeContext({
                    packageManager: "npm",
                    packagesJson: JSON.stringify({ flags: ["--force"] })
                })
            );

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "npm",
                ["install", "--force"],
                expect.any(Object)
            );
        });
    });
});
