import { describe, it, expect, beforeEach, vi } from "vitest";

import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { ForgeService } from "../abstractions/ForgeService.js";
import { CommandRunner } from "../../CommandRunner/index.js";

function createMockCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(),
        runStreaming: vi.fn()
    };
}

function createForgeService(
    commandRunner: CommandRunner.Interface,
    container: ReturnType<typeof createTestApiContainer>["container"]
): ForgeService.Interface {
    container.registerInstance(CommandRunner, commandRunner);
    return container.resolve(ForgeService);
}

describe("ForgeService", () => {
    let commandRunner: CommandRunner.Interface;
    let container: ReturnType<typeof createTestApiContainer>["container"];

    beforeEach(async () => {
        const result = createTestApiContainer();
        container = result.container;
        commandRunner = createMockCommandRunner();
    });

    describe("detectForge", () => {
        it("detects GitHub from HTTPS URL", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "https://github.com/owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, container);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("github");
        });

        it("detects GitHub from SSH URL", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "git@github.com:owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, container);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("github");
        });

        it("detects GitLab from HTTPS URL", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "https://gitlab.com/group/project.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, container);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("gitlab");
        });

        it("returns unknown for other URLs", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "https://bitbucket.org/owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, container);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("unknown");
        });
    });

    describe("parseRemoteUrl", () => {
        it("extracts owner/repo from HTTPS GitHub URL", () => {
            const result = createForgeService(createMockCommandRunner(), container).parseRemoteUrl(
                "https://github.com/owner/repo.git"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("extracts owner/repo from SSH GitHub URL", () => {
            const result = createForgeService(createMockCommandRunner(), container).parseRemoteUrl(
                "git@github.com:owner/repo.git"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("extracts owner/repo from SSH GitLab URL", () => {
            const result = createForgeService(createMockCommandRunner(), container).parseRemoteUrl(
                "git@gitlab.com:owner/repo.git"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("handles URLs without .git suffix", () => {
            const result = createForgeService(createMockCommandRunner(), container).parseRemoteUrl(
                "https://github.com/owner/repo"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("extracts project path from GitLab HTTPS URL", () => {
            const result = createForgeService(createMockCommandRunner(), container).parseRemoteUrl(
                "https://gitlab.com/group/subgroup/project.git"
            );
            expect(result).toEqual({
                owner: "group/subgroup",
                repo: "project"
            });
        });
    });

    describe("createPr", () => {
        it("throws when forge is unknown", async () => {
            vi.mocked(commandRunner.run).mockResolvedValue({
                stdout: "https://bitbucket.org/owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, container);

            await expect(
                service.createPr({
                    projectPath: "/test",
                    title: "PR",
                    body: "",
                    head: "feature",
                    base: "main"
                })
            ).rejects.toThrow("Cannot detect git forge from remote URL");
        });

        it("throws when GitHub token is missing", async () => {
            vi.mocked(commandRunner.run).mockResolvedValue({
                stdout: "https://github.com/owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, container);

            await expect(
                service.createPr({
                    projectPath: "/test",
                    title: "PR",
                    body: "",
                    head: "feature",
                    base: "main"
                })
            ).rejects.toThrow("GitHub token not configured");
        });

        it("throws when GitLab token is missing", async () => {
            vi.mocked(commandRunner.run).mockResolvedValue({
                stdout: "https://gitlab.com/owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, container);

            await expect(
                service.createPr({
                    projectPath: "/test",
                    title: "PR",
                    body: "",
                    head: "feature",
                    base: "main"
                })
            ).rejects.toThrow("GitLab token not configured");
        });
    });
});
