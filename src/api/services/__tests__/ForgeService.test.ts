import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { ForgeService } from "../abstractions/ForgeService.js";
import { ForgeService as ForgeServiceRegistration } from "../ForgeService.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { registerEncryption } from "#testing/helpers/registerEncryption.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

function createMockCommandRunner(): CommandRunner.Interface {
    return {
        run: vi.fn(),
        runStreaming: vi.fn()
    };
}

function createForgeService(
    commandRunner: CommandRunner.Interface,
    db: TestDb
): ForgeService.Interface {
    const container = createContainer();
    container.registerInstance(CommandRunner, commandRunner);
    container.registerInstance(DatabaseClient, { db });
    registerEncryption(container);
    container.register(ForgeServiceRegistration).inSingletonScope();
    return container.resolve(ForgeService);
}

describe("ForgeService", () => {
    let db: TestDb;
    let commandRunner: CommandRunner.Interface;

    beforeEach(async () => {
        db = await createTestDb();
        commandRunner = createMockCommandRunner();
    });

    describe("detectForge", () => {
        it("detects GitHub from HTTPS URL", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "https://github.com/owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, db);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("github");
        });

        it("detects GitHub from SSH URL", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "git@github.com:owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, db);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("github");
        });

        it("detects GitLab from HTTPS URL", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "https://gitlab.com/group/project.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, db);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("gitlab");
        });

        it("returns unknown for other URLs", async () => {
            vi.mocked(commandRunner.run).mockResolvedValueOnce({
                stdout: "https://bitbucket.org/owner/repo.git",
                stderr: "",
                exitCode: 0
            });

            const service = createForgeService(commandRunner, db);
            const forge = await service.detectForge("/test");
            expect(forge).toBe("unknown");
        });
    });

    describe("parseRemoteUrl", () => {
        it("extracts owner/repo from HTTPS GitHub URL", () => {
            const result = createForgeService(createMockCommandRunner(), db).parseRemoteUrl(
                "https://github.com/owner/repo.git"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("extracts owner/repo from SSH GitHub URL", () => {
            const result = createForgeService(createMockCommandRunner(), db).parseRemoteUrl(
                "git@github.com:owner/repo.git"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("extracts owner/repo from SSH GitLab URL", () => {
            const result = createForgeService(createMockCommandRunner(), db).parseRemoteUrl(
                "git@gitlab.com:owner/repo.git"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("handles URLs without .git suffix", () => {
            const result = createForgeService(createMockCommandRunner(), db).parseRemoteUrl(
                "https://github.com/owner/repo"
            );
            expect(result).toEqual({ owner: "owner", repo: "repo" });
        });

        it("extracts project path from GitLab HTTPS URL", () => {
            const result = createForgeService(createMockCommandRunner(), db).parseRemoteUrl(
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

            const service = createForgeService(commandRunner, db);

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

            const service = createForgeService(commandRunner, db);

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

            const service = createForgeService(commandRunner, db);

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
