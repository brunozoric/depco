import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { GitService } from "../abstractions/GitService.js";
import { GitService as GitServiceRegistration } from "../GitService.js";

function createService(runHandler: CommandRunner.Interface["run"]): GitService.Interface {
    const container = createContainer();
    container.registerInstance(CommandRunner, {
        run: runHandler,
        runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    });
    container.register(GitServiceRegistration);
    return container.resolve(GitService);
}

describe("GitService", () => {
    it("getCurrentBranch returns trimmed branch name", async () => {
        const service = createService(async () => ({
            stdout: "  main\n",
            stderr: "",
            exitCode: 0
        }));

        const branch = await service.getCurrentBranch("/test/path");
        expect(branch).toBe("main");
    });

    it("getCurrentBranch passes correct git command", async () => {
        const calls: Array<{ cmd: string; args: string[] }> = [];
        const service = createService(async (cmd, args) => {
            calls.push({ cmd, args: args ?? [] });
            return { stdout: "main\n", stderr: "", exitCode: 0 };
        });

        await service.getCurrentBranch("/test/path");
        expect(calls[0]).toEqual({
            cmd: "git",
            args: ["rev-parse", "--abbrev-ref", "HEAD"]
        });
    });

    it("createAndCheckoutBranch runs git checkout -b", async () => {
        const calls: Array<{ cmd: string; args: string[] }> = [];
        const service = createService(async (cmd, args) => {
            calls.push({ cmd, args: args ?? [] });
            return { stdout: "", stderr: "", exitCode: 0 };
        });

        await service.createAndCheckoutBranch("/test/path", "feature/test");
        expect(calls[0]).toEqual({
            cmd: "git",
            args: ["checkout", "-b", "feature/test"]
        });
    });

    it("checkout runs git checkout without -b", async () => {
        const calls: Array<{ cmd: string; args: string[] }> = [];
        const service = createService(async (cmd, args) => {
            calls.push({ cmd, args: args ?? [] });
            return { stdout: "", stderr: "", exitCode: 0 };
        });

        await service.checkout("/test/path", "main");
        expect(calls[0]).toEqual({
            cmd: "git",
            args: ["checkout", "main"]
        });
    });

    it("getStatus returns array of changed file paths", async () => {
        const service = createService(async () => ({
            stdout: " M src/file1.ts\n?? src/file2.ts\n",
            stderr: "",
            exitCode: 0
        }));

        const files = await service.getStatus("/test/path");
        expect(files).toEqual([" M src/file1.ts", "?? src/file2.ts"]);
    });

    it("getStatus returns empty array for clean working tree", async () => {
        const service = createService(async () => ({
            stdout: "",
            stderr: "",
            exitCode: 0
        }));

        const files = await service.getStatus("/test/path");
        expect(files).toEqual([]);
    });

    it("stageAll runs git add -A", async () => {
        const calls: Array<{ cmd: string; args: string[] }> = [];
        const service = createService(async (cmd, args) => {
            calls.push({ cmd, args: args ?? [] });
            return { stdout: "", stderr: "", exitCode: 0 };
        });

        await service.stageAll("/test/path");
        expect(calls[0]).toEqual({ cmd: "git", args: ["add", "-A"] });
    });

    it("commit runs git commit and returns trimmed hash", async () => {
        const calls: Array<{ cmd: string; args: string[] }> = [];
        const service = createService(async (cmd, args) => {
            calls.push({ cmd, args: args ?? [] });
            if (args?.includes("rev-parse")) {
                return { stdout: "abc1234def\n", stderr: "", exitCode: 0 };
            }
            return { stdout: "", stderr: "", exitCode: 0 };
        });

        const hash = await service.commit("/test/path", "chore: update deps");
        expect(calls[0]).toEqual({
            cmd: "git",
            args: ["commit", "-m", "chore: update deps"]
        });
        expect(calls[1]).toEqual({
            cmd: "git",
            args: ["rev-parse", "--short", "HEAD"]
        });
        expect(hash).toBe("abc1234def");
    });

    describe("push", () => {
        it("calls git push with correct arguments", async () => {
            const calls: Array<{ cmd: string; args: string[] }> = [];
            const service = createService(async (cmd, args) => {
                calls.push({ cmd, args: args ?? [] });
                return { stdout: "Everything up-to-date", stderr: "", exitCode: 0 };
            });

            const result = await service.push("/test/project", "origin", "my-branch");

            expect(calls[0]).toEqual({
                cmd: "git",
                args: ["push", "-u", "origin", "my-branch"]
            });
            expect(result.success).toBe(true);
        });

        it("returns failure when push fails", async () => {
            const service = createService(async () => ({
                stdout: "",
                stderr: "fatal: remote origin not found",
                exitCode: 128
            }));

            const result = await service.push("/test/project", "origin", "my-branch");
            expect(result.success).toBe(false);
            expect(result.output).toContain("fatal: remote origin not found");
        });
    });
});
