import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { FileConfigService } from "../abstractions/FileConfigService.js";

describe("FileConfigService", () => {
    let tempDir: string;
    let service: FileConfigService.Interface;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
        const { container } = createTestApiContainer();
        service = container.resolve(FileConfigService);
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it("returns null when config file does not exist", async () => {
        const result = await service.readConfig(tempDir);
        expect(result).toBeNull();
    });

    it("returns parsed config when valid file exists", async () => {
        const config = {
            stepHooks: [
                {
                    position: "pre:upgrade",
                    name: "Lint",
                    command: "yarn lint",
                    executionType: "command",
                    required: true
                }
            ]
        };
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify(config),
            "utf-8"
        );

        const result = await service.readConfig(tempDir);
        expect(result).toEqual(config);
    });

    it("returns config with empty stepHooks array", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({ stepHooks: [] }),
            "utf-8"
        );

        const result = await service.readConfig(tempDir);
        expect(result).toEqual({ stepHooks: [] });
    });

    it("throws on malformed JSON", async () => {
        await writeFile(join(tempDir, ".dependency-upgrader.json"), "not valid json{{{", "utf-8");

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("throws on invalid schema", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({ stepHooks: [{ invalid: true }] }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("throws when stepHooks entry missing required fields", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({
                stepHooks: [{ position: "pre:upgrade", name: "Lint" }]
            }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("throws on non-ENOENT filesystem error (e.g., reading a directory)", async () => {
        // Force EISDIR: make the config path itself a directory instead of a file.
        await mkdir(join(tempDir, ".dependency-upgrader.json"));

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("returns parsed config with pmSettings security", async () => {
        const config = {
            pmSettings: {
                pnpm: {
                    security: {
                        ignoreScripts: "true",
                        strictSsl: "true"
                    }
                }
            }
        };
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify(config),
            "utf-8"
        );

        const result = await service.readConfig(tempDir);
        expect(result!.pmSettings!["pnpm"]!.security).toEqual({
            ignoreScripts: "true",
            strictSsl: "true"
        });
    });

    it("returns parsed config with pmSettings installFlags", async () => {
        const config = {
            pmSettings: {
                pnpm: {
                    installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true }
                }
            }
        };
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify(config),
            "utf-8"
        );

        const result = await service.readConfig(tempDir);
        expect(result!.pmSettings!["pnpm"]!.installFlags).toEqual({
            "--frozen-lockfile": true,
            "--ignore-scripts": true
        });
    });

    it("throws on unknown install flag for known PM", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({
                pmSettings: { pnpm: { installFlags: { "--nonexistent": true } } }
            }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("returns parsed config with registryUrl and upgradeStrategy", async () => {
        const config = {
            pmSettings: {
                pnpm: {
                    registryUrl: "https://registry.npmmirror.com",
                    upgradeStrategy: "exact"
                }
            }
        };
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify(config),
            "utf-8"
        );

        const result = await service.readConfig(tempDir);
        expect(result!.pmSettings!["pnpm"]!.registryUrl).toBe("https://registry.npmmirror.com");
        expect(result!.pmSettings!["pnpm"]!.upgradeStrategy).toBe("exact");
    });

    it("throws on invalid upgradeStrategy", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({
                pmSettings: { pnpm: { upgradeStrategy: "yolo" } }
            }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("throws when using old securitySettings key", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({
                securitySettings: { pnpm: { ignoreScripts: "true" } }
            }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("throws on unknown package manager in pmSettings", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({ pmSettings: { deno: { security: { foo: "bar" } } } }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("throws on unknown security field for known PM in pmSettings", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({
                pmSettings: { pnpm: { security: { nonExistentField: "true" } } }
            }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("throws on invalid security field value in pmSettings", async () => {
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify({
                pmSettings: { pnpm: { security: { minimumReleaseAge: "abc" } } }
            }),
            "utf-8"
        );

        await expect(service.readConfig(tempDir)).rejects.toThrow();
    });

    it("parses pmSettings with multiple package managers", async () => {
        const config = {
            pmSettings: {
                pnpm: { security: { ignoreScripts: "true" } },
                yarn: { security: { npmMinimalAgeGate: "3d" } }
            }
        };
        await writeFile(
            join(tempDir, ".dependency-upgrader.json"),
            JSON.stringify(config),
            "utf-8"
        );

        const result = await service.readConfig(tempDir);
        expect(result!.pmSettings).toEqual(config.pmSettings);
    });

    describe("readGlobalConfig", () => {
        it("returns config null and no error when no file exists", async () => {
            const result = await service.readGlobalConfig();
            expect(result.config).toBeNull();
            expect(result.error).toBeUndefined();
        });

        it("returns error result on malformed JSON", async () => {
            await writeFile(
                join(process.cwd(), ".dependency-upgrader.json"),
                "not valid json{{{",
                "utf-8"
            );

            try {
                const result = await service.readGlobalConfig();
                expect(result.config).toBeNull();
                expect(result.error).toBeDefined();
                expect(result.error!.type).toBe("json");
            } finally {
                await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
            }
        });

        it("returns error result on invalid schema", async () => {
            await writeFile(
                join(process.cwd(), ".dependency-upgrader.json"),
                JSON.stringify({ settings: { logLevel: "banana" } }),
                "utf-8"
            );

            try {
                const result = await service.readGlobalConfig();
                expect(result.config).toBeNull();
                expect(result.error).toBeDefined();
                expect(result.error!.type).toBe("schema");
            } finally {
                await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
            }
        });

        it("returns parsed config when file is valid", async () => {
            await writeFile(
                join(process.cwd(), ".dependency-upgrader.json"),
                JSON.stringify({ settings: { logLevel: "info" } }),
                "utf-8"
            );

            try {
                const result = await service.readGlobalConfig();
                expect(result.config).toBeDefined();
                expect(result.config!.settings!.logLevel).toBe("info");
                expect(result.error).toBeUndefined();
            } finally {
                await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
            }
        });

        it("returns cached result within TTL without re-reading file", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({ settings: { logLevel: "info" } }),
                "utf-8"
            );

            try {
                const first = await service.readGlobalConfig();
                expect(first.config!.settings!.logLevel).toBe("info");

                // Change file contents — cache should return old value
                await writeFile(
                    configPath,
                    JSON.stringify({ settings: { logLevel: "error" } }),
                    "utf-8"
                );

                const second = await service.readGlobalConfig();
                expect(second.config!.settings!.logLevel).toBe("info");
            } finally {
                await rm(configPath, { force: true });
            }
        });

        it("re-reads file after cache TTL expires", async () => {
            vi.useFakeTimers();
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({ settings: { logLevel: "info" } }),
                "utf-8"
            );

            try {
                const first = await service.readGlobalConfig();
                expect(first.config!.settings!.logLevel).toBe("info");

                await writeFile(
                    configPath,
                    JSON.stringify({ settings: { logLevel: "error" } }),
                    "utf-8"
                );

                vi.advanceTimersByTime(10_001);

                const second = await service.readGlobalConfig();
                expect(second.config!.settings!.logLevel).toBe("error");
            } finally {
                await rm(configPath, { force: true });
                vi.useRealTimers();
            }
        });

        it("caches error results within TTL", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(configPath, "bad json{{{", "utf-8");

            try {
                const first = await service.readGlobalConfig();
                expect(first.error).toBeDefined();

                // Fix the file — cache should still return error
                await writeFile(
                    configPath,
                    JSON.stringify({ settings: { logLevel: "info" } }),
                    "utf-8"
                );

                const second = await service.readGlobalConfig();
                expect(second.error).toBeDefined();
            } finally {
                await rm(configPath, { force: true });
            }
        });
    });

    describe("readGlobalSettings", () => {
        it("returns null when no file exists", async () => {
            const result = await service.readGlobalSettings();
            expect(result.settings).toBeNull();
        });

        it("returns parsed settings when file has settings key", async () => {
            const config = {
                settings: {
                    branchTemplate: "chore/deps-${YYYY}",
                    commitTemplate: "chore: deps",
                    logLevel: "info" as const
                }
            };
            await writeFile(
                join(process.cwd(), ".dependency-upgrader.json"),
                JSON.stringify(config),
                "utf-8"
            );

            try {
                const result = await service.readGlobalSettings();
                expect(result.settings).toEqual(config.settings);
            } finally {
                await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
            }
        });

        it("returns null when file exists but has no settings key", async () => {
            const config = {
                stepHooks: [
                    {
                        position: "pre:upgrade",
                        name: "Lint",
                        command: "yarn lint",
                        executionType: "command",
                        required: true
                    }
                ]
            };
            await writeFile(
                join(process.cwd(), ".dependency-upgrader.json"),
                JSON.stringify(config),
                "utf-8"
            );

            try {
                const result = await service.readGlobalSettings();
                expect(result.settings).toBeNull();
            } finally {
                await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
            }
        });

        it("returns error result on malformed JSON", async () => {
            await writeFile(
                join(process.cwd(), ".dependency-upgrader.json"),
                "not valid json{{{",
                "utf-8"
            );

            try {
                const result = await service.readGlobalSettings();
                expect(result.settings).toBeNull();
                expect(result.error).toBeDefined();
                expect(result.error!.type).toBe("json");
            } finally {
                await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
            }
        });

        it("returns error result on invalid logLevel value", async () => {
            await writeFile(
                join(process.cwd(), ".dependency-upgrader.json"),
                JSON.stringify({ settings: { logLevel: "banana" } }),
                "utf-8"
            );

            try {
                const result = await service.readGlobalSettings();
                expect(result.settings).toBeNull();
                expect(result.error).toBeDefined();
                expect(result.error!.type).toBe("schema");
            } finally {
                await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
            }
        });

        it("throws on non-ENOENT filesystem error", async () => {
            // Force EISDIR: make the config path itself a directory instead of a file.
            await mkdir(join(tempDir, ".dependency-upgrader.json"));
            const originalCwd = process.cwd;
            process.cwd = () => tempDir;
            try {
                await expect(service.readGlobalSettings()).rejects.toThrow();
            } finally {
                process.cwd = originalCwd;
            }
        });
    });

    describe("writeGlobalPmSettings", () => {
        afterEach(async () => {
            await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
        });

        it("creates file with pmSettings when file does not exist", async () => {
            await service.writeGlobalPmSettings("pnpm", {
                installFlags: { "--frozen-lockfile": true }
            });

            const result = await service.readGlobalConfig();
            expect(result.config?.pmSettings?.["pnpm"]?.installFlags).toEqual({
                "--frozen-lockfile": true
            });
        });

        it("merges into existing file preserving other sections", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({
                    settings: { logLevel: "info" },
                    pmSettings: {
                        yarn: { registryUrl: "https://yarn.example.com" }
                    }
                }),
                "utf-8"
            );

            await service.writeGlobalPmSettings("pnpm", {
                upgradeStrategy: "exact"
            });

            const raw = JSON.parse(await readFile(configPath, "utf-8"));
            expect(raw.settings.logLevel).toBe("info");
            expect(raw.pmSettings.yarn.registryUrl).toBe("https://yarn.example.com");
            expect(raw.pmSettings.pnpm.upgradeStrategy).toBe("exact");
        });

        it("merges into existing PM section preserving other PM fields", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        pnpm: {
                            registryUrl: "https://existing.com",
                            installFlags: { "--force": true }
                        }
                    }
                }),
                "utf-8"
            );

            await service.writeGlobalPmSettings("pnpm", {
                upgradeStrategy: "tilde"
            });

            const raw = JSON.parse(await readFile(configPath, "utf-8"));
            expect(raw.pmSettings.pnpm.registryUrl).toBe("https://existing.com");
            expect(raw.pmSettings.pnpm.installFlags).toEqual({ "--force": true });
            expect(raw.pmSettings.pnpm.upgradeStrategy).toBe("tilde");
        });

        it("overwrites existing field in PM section", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({
                    pmSettings: {
                        pnpm: { upgradeStrategy: "caret" }
                    }
                }),
                "utf-8"
            );

            await service.writeGlobalPmSettings("pnpm", {
                upgradeStrategy: "exact"
            });

            const raw = JSON.parse(await readFile(configPath, "utf-8"));
            expect(raw.pmSettings.pnpm.upgradeStrategy).toBe("exact");
        });

        it("invalidates cache after write", async () => {
            const configPath = join(process.cwd(), ".dependency-upgrader.json");
            await writeFile(
                configPath,
                JSON.stringify({ pmSettings: { yarn: { upgradeStrategy: "caret" } } }),
                "utf-8"
            );

            // Prime cache
            const before = await service.readGlobalConfig();
            expect(before.config?.pmSettings?.["yarn"]?.upgradeStrategy).toBe("caret");

            await service.writeGlobalPmSettings("yarn", { upgradeStrategy: "exact" });

            // Should read fresh, not cached
            const after = await service.readGlobalConfig();
            expect(after.config?.pmSettings?.["yarn"]?.upgradeStrategy).toBe("exact");
        });
    });
});
