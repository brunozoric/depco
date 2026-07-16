import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createContainer } from "#shared/index.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { PackageManagerService } from "../abstractions/PackageManagerService.js";
import { PackageManagerService as PackageManagerServiceRegistration } from "../PackageManagerService.js";
import { PackageManagerDriverRegistry as RegistryRegistration } from "../packageManagers/PackageManagerDriverRegistry.js";
import { AuditParserService as AuditParserServiceRegistration } from "../AuditParserService.js";

function createMockCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
        runStreaming: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
    };
}

describe("PackageManagerService", () => {
    let service: PackageManagerService.Interface;
    let commandRunner: CommandRunner.Interface;

    beforeEach(() => {
        const container = createContainer();
        commandRunner = createMockCommandRunner();
        container.registerInstance(CommandRunner, commandRunner);
        container.register(RegistryRegistration).inSingletonScope();
        container.register(AuditParserServiceRegistration).inSingletonScope();
        container.register(PackageManagerServiceRegistration).inSingletonScope();
        service = container.resolve(PackageManagerService);
    });

    describe("detect", () => {
        let testDir: string;

        beforeEach(() => {
            testDir = join(
                tmpdir(),
                `pm-service-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
            );
            mkdirSync(testDir, { recursive: true });
        });

        afterEach(() => {
            rmSync(testDir, { recursive: true, force: true });
        });

        it("detects yarn when yarn.lock exists", async () => {
            writeFileSync(join(testDir, "yarn.lock"), "");

            const pm = await service.detect(testDir);

            expect(pm).toBe("yarn");
        });

        it("detects pnpm when pnpm-lock.yaml exists", async () => {
            writeFileSync(join(testDir, "pnpm-lock.yaml"), "");

            const pm = await service.detect(testDir);

            expect(pm).toBe("pnpm");
        });

        it("detects npm when package-lock.json exists", async () => {
            writeFileSync(join(testDir, "package-lock.json"), "");

            const pm = await service.detect(testDir);

            expect(pm).toBe("npm");
        });

        it("prefers yarn.lock over pnpm-lock.yaml and package-lock.json", async () => {
            writeFileSync(join(testDir, "yarn.lock"), "");
            writeFileSync(join(testDir, "pnpm-lock.yaml"), "");
            writeFileSync(join(testDir, "package-lock.json"), "");

            const pm = await service.detect(testDir);

            expect(pm).toBe("yarn");
        });

        it("throws when no lockfile is found", async () => {
            await expect(service.detect(testDir)).rejects.toThrow("No package manager detected");
        });
    });

    describe("getVersion", () => {
        it("returns the trimmed yarn version", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: "4.7.0\n",
                stderr: "",
                exitCode: 0
            }));

            const version = await service.getVersion("/project", "yarn");

            expect(version).toBe("4.7.0");
            expect(commandRunner.run).toHaveBeenCalledWith("yarn", ["--version"], {
                cwd: "/project"
            });
        });

        it("returns the trimmed npm version", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: "10.8.1\n",
                stderr: "",
                exitCode: 0
            }));

            const version = await service.getVersion("/project", "npm");

            expect(version).toBe("10.8.1");
            expect(commandRunner.run).toHaveBeenCalledWith("npm", ["--version"], {
                cwd: "/project"
            });
        });

        it("returns the trimmed pnpm version", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: "9.1.0\n",
                stderr: "",
                exitCode: 0
            }));

            const version = await service.getVersion("/project", "pnpm");

            expect(version).toBe("9.1.0");
            expect(commandRunner.run).toHaveBeenCalledWith("pnpm", ["--version"], {
                cwd: "/project"
            });
        });
    });

    describe("updateVersion", () => {
        it("updates the yarn version via yarn set version", async () => {
            const onLog = vi.fn();
            await service.updateVersion("/project", "yarn", "4.7.0", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "yarn",
                ["set", "version", "4.7.0"],
                expect.objectContaining({
                    cwd: "/project",
                    onStdout: onLog,
                    onStderr: onLog
                })
            );
        });

        it("updates the npm version via npm install -g", async () => {
            const onLog = vi.fn();
            await service.updateVersion("/project", "npm", "10.9.0", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "npm",
                ["install", "-g", "npm@10.9.0"],
                expect.objectContaining({
                    cwd: "/project",
                    onStdout: onLog,
                    onStderr: onLog
                })
            );
        });

        it("updates the pnpm version via pnpm add -g", async () => {
            const onLog = vi.fn();
            await service.updateVersion("/project", "pnpm", "9.5.0", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "pnpm",
                ["add", "-g", "pnpm@9.5.0"],
                expect.objectContaining({
                    cwd: "/project",
                    onStdout: onLog,
                    onStderr: onLog
                })
            );
        });
    });

    describe("audit", () => {
        it("runs the npm audit command and parses vulnerabilities from stdout", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: JSON.stringify({
                    vulnerabilities: {
                        lodash: {
                            name: "lodash",
                            severity: "high",
                            via: [
                                {
                                    title: "Prototype Pollution in lodash",
                                    url: "https://github.com/advisories/GHSA-1",
                                    severity: "high",
                                    range: "<4.17.21"
                                }
                            ],
                            fixAvailable: {
                                name: "lodash",
                                version: "4.17.21",
                                isSemVerMajor: false
                            }
                        }
                    }
                }),
                stderr: "",
                exitCode: 1
            }));

            const vulnerabilities = await service.audit("/project", "npm");

            expect(commandRunner.run).toHaveBeenCalledWith("npm", ["audit", "--json"], {
                cwd: "/project"
            });
            expect(vulnerabilities).toEqual([
                {
                    packageName: "lodash",
                    severity: "high",
                    title: "Prototype Pollution in lodash",
                    advisoryUrl: "https://github.com/advisories/GHSA-1",
                    cveId: null,
                    vulnerableRange: "<4.17.21",
                    fixVersion: "4.17.21"
                }
            ]);
        });

        it("does not throw when the audit command exits with code 1 (vulnerabilities found)", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: JSON.stringify({ vulnerabilities: {} }),
                stderr: "",
                exitCode: 1
            }));

            await expect(service.audit("/project", "npm")).resolves.toEqual([]);
        });

        it("throws when stdout is empty and stderr is non-empty", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: "",
                stderr: "npm error something went wrong",
                exitCode: 1
            }));

            await expect(service.audit("/project", "npm")).rejects.toThrow("Audit command failed");
        });

        it("throws when exit code is greater than 1 even if stdout has content", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: "some partial output",
                stderr: "fatal: registry unreachable",
                exitCode: 2
            }));

            await expect(service.audit("/project", "npm")).rejects.toThrow(
                "Audit command failed for npm at /project (exit 2)"
            );
        });

        it("includes stdout in error when exit code > 1 and stderr is empty", async () => {
            commandRunner.run = vi.fn(async () => ({
                stdout: "Usage: npm audit",
                stderr: "",
                exitCode: 2
            }));

            await expect(service.audit("/project", "npm")).rejects.toThrow("Usage: npm audit");
        });

        it("runs the yarn audit command with the driver's args", async () => {
            commandRunner.run = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }));

            await service.audit("/project", "yarn");

            expect(commandRunner.run).toHaveBeenCalledWith(
                "yarn",
                ["npm", "audit", "--recursive", "--json"],
                { cwd: "/project" }
            );
        });

        it("runs the pnpm audit command with the driver's args", async () => {
            commandRunner.run = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }));

            await service.audit("/project", "pnpm");

            expect(commandRunner.run).toHaveBeenCalledWith("pnpm", ["audit", "--json"], {
                cwd: "/project"
            });
        });

        it("runs the bun audit command with the driver's args", async () => {
            commandRunner.run = vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }));

            await service.audit("/project", "bun");

            expect(commandRunner.run).toHaveBeenCalledWith("bun", ["audit", "--json"], {
                cwd: "/project"
            });
        });
    });
});
