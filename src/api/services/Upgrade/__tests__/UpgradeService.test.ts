import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { FileConfigService } from "../../FileConfig/index.js";
import { UpgradeService } from "../abstractions/UpgradeService.js";

function createMockCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
        runStreaming: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
    };
}

function createStubFileConfigService(
    upgradeStrategy?: FileConfigService.PmSettings["upgradeStrategy"]
): FileConfigService.Interface {
    return {
        readConfig: async () => null,
        readGlobalSettings: async () => ({ settings: null }),
        readGlobalConfig: async () => ({
            config: upgradeStrategy ? { pmSettings: { yarn: { upgradeStrategy } } } : null
        }),
        writeGlobalPmSettings: async () => {}
    };
}

describe("UpgradeService", () => {
    let service: UpgradeService.Interface;
    let commandRunner: CommandRunner.Interface;

    function createService(
        fileConfigService: FileConfigService.Interface = createStubFileConfigService()
    ): UpgradeService.Interface {
        const { container } = createTestApiContainer();
        commandRunner = createMockCommandRunner();
        container.registerInstance(CommandRunner, commandRunner);
        container.registerInstance(FileConfigService, fileConfigService);
        return container.resolve(UpgradeService);
    }

    beforeEach(() => {
        service = createService();
    });

    it("upgrades a package via yarn up", async () => {
        const onLog = vi.fn();
        await service.upgradePackage("/project", "react", "19.0.0", "yarn", onLog);

        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "yarn",
            ["up", "react@^19.0.0"],
            expect.objectContaining({
                cwd: "/project",
                onStdout: onLog,
                onStderr: onLog
            })
        );
    });

    it("rejects package names starting with a dash", async () => {
        const onLog = vi.fn();

        await expect(
            service.upgradePackage("/project", "-malicious", "1.0.0", "yarn", onLog)
        ).rejects.toThrow("Invalid package name: -malicious");
        expect(commandRunner.runStreaming).not.toHaveBeenCalled();
    });

    it("refreshes transient dependencies via yarn up ** -R", async () => {
        const onLog = vi.fn();
        await service.refreshTransient("/project", "yarn", onLog);

        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "yarn",
            ["up", "**", "-R"],
            expect.objectContaining({
                cwd: "/project",
                onStdout: onLog,
                onStderr: onLog
            })
        );
    });

    it("uses npm install for npm package manager", async () => {
        const onLog = vi.fn();
        await service.upgradePackage("/project", "react", "19.0.0", "npm", onLog);
        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "npm",
            ["install", "react@^19.0.0"],
            expect.objectContaining({ cwd: "/project" })
        );
    });

    it("uses pnpm update for pnpm package manager", async () => {
        const onLog = vi.fn();
        await service.upgradePackage("/project", "react", "19.0.0", "pnpm", onLog);
        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "pnpm",
            ["update", "react@^19.0.0"],
            expect.objectContaining({ cwd: "/project" })
        );
    });

    it("uses npm update for npm refreshTransient", async () => {
        const onLog = vi.fn();
        await service.refreshTransient("/project", "npm", onLog);
        expect(commandRunner.runStreaming).toHaveBeenCalledWith(
            "npm",
            ["update"],
            expect.objectContaining({ cwd: "/project" })
        );
    });

    describe("upgrade strategy from file config", () => {
        it("applies caret prefix when upgradeStrategy is caret", async () => {
            const strategyService = createService(createStubFileConfigService("caret"));
            const onLog = vi.fn();

            await strategyService.upgradePackage("/project", "react", "4.17.21", "yarn", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "yarn",
                ["up", "react@^4.17.21"],
                expect.objectContaining({ cwd: "/project" })
            );
        });

        it("applies tilde prefix when upgradeStrategy is tilde", async () => {
            const strategyService = createService(createStubFileConfigService("tilde"));
            const onLog = vi.fn();

            await strategyService.upgradePackage("/project", "react", "4.17.21", "yarn", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "yarn",
                ["up", "react@~4.17.21"],
                expect.objectContaining({ cwd: "/project" })
            );
        });

        it("applies exact (no prefix) when upgradeStrategy is exact", async () => {
            const strategyService = createService(createStubFileConfigService("exact"));
            const onLog = vi.fn();

            await strategyService.upgradePackage("/project", "react", "4.17.21", "yarn", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "yarn",
                ["up", "react@4.17.21"],
                expect.objectContaining({ cwd: "/project" })
            );
        });

        it("replaces the version with * when upgradeStrategy is latest", async () => {
            const strategyService = createService(createStubFileConfigService("latest"));
            const onLog = vi.fn();

            await strategyService.upgradePackage("/project", "react", "4.17.21", "yarn", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "yarn",
                ["up", "react@*"],
                expect.objectContaining({ cwd: "/project" })
            );
        });

        it("defaults to caret prefix when no upgradeStrategy configured", async () => {
            const strategyService = createService(createStubFileConfigService());
            const onLog = vi.fn();

            await strategyService.upgradePackage("/project", "react", "4.17.21", "yarn", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "yarn",
                ["up", "react@^4.17.21"],
                expect.objectContaining({ cwd: "/project" })
            );
        });

        it("only applies the strategy configured for the target package manager", async () => {
            const strategyService = createService(createStubFileConfigService("exact"));
            const onLog = vi.fn();

            await strategyService.upgradePackage("/project", "react", "4.17.21", "npm", onLog);

            expect(commandRunner.runStreaming).toHaveBeenCalledWith(
                "npm",
                ["install", "react@^4.17.21"],
                expect.objectContaining({ cwd: "/project" })
            );
        });
    });
});
