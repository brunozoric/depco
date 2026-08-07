import { describe, it, expect } from "vitest";
import { GitHubReleasesResolver } from "../resolvers/GitHubReleasesResolver.js";
import type { CommandRunner } from "../../CommandRunner/index.js";

type RunHandler = CommandRunner.Interface["run"];

function createCommandRunner(runHandler: RunHandler): CommandRunner.Interface {
    return {
        run: runHandler,
        runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    };
}

describe("GitHubReleasesResolver", () => {
    it("returns an empty map when repoUrl is null", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
        );

        const result = await resolver.resolve("some-package", null, ["1.0.0"]);

        expect(result.size).toBe(0);
    });

    it("returns an empty map when `gh --version` fails", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "", stderr: "not found", exitCode: 1 };
                }
                return { stdout: "[]", stderr: "", exitCode: 0 };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("returns an empty map when the `gh --version` command throws", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async () => {
                throw new Error("gh not installed");
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("parses releases JSON and matches versions by tag, with and without a `v` prefix", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                return {
                    stdout: JSON.stringify([
                        { tag_name: "v1.0.0", body: "release notes for 1.0.0" },
                        { tag_name: "2.0.0", body: "release notes for 2.0.0" },
                        { tag_name: "v3.0.0", body: null }
                    ]),
                    stderr: "",
                    exitCode: 0
                };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0",
            "2.0.0",
            "3.0.0"
        ]);

        expect(result.size).toBe(2);
        expect(result.get("1.0.0")).toBe("release notes for 1.0.0");
        expect(result.get("2.0.0")).toBe("release notes for 2.0.0");
        expect(result.has("3.0.0")).toBe(false);
    });

    it("returns an empty map on API error (non-zero exit code)", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                return { stdout: "", stderr: "API rate limited", exitCode: 1 };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("matches monorepo tags using packageName@version format", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                return {
                    stdout: JSON.stringify([
                        { tag_name: "ai@7.0.41", body: "ai release" },
                        {
                            tag_name: "@ai-sdk/anthropic@4.0.21",
                            body: "anthropic 4.0.21 notes"
                        },
                        {
                            tag_name: "@ai-sdk/anthropic@4.0.20",
                            body: "anthropic 4.0.20 notes"
                        },
                        { tag_name: "@ai-sdk/openai@4.0.21", body: "openai notes" }
                    ]),
                    stderr: "",
                    exitCode: 0
                };
            })
        );

        const result = await resolver.resolve("@ai-sdk/anthropic", "https://github.com/vercel/ai", [
            "4.0.20",
            "4.0.21"
        ]);

        expect(result.size).toBe(2);
        expect(result.get("4.0.21")).toBe("anthropic 4.0.21 notes");
        expect(result.get("4.0.20")).toBe("anthropic 4.0.20 notes");
    });

    it("does not match monorepo tags from a different package at the same version", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                return {
                    stdout: JSON.stringify([
                        { tag_name: "@ai-sdk/openai@4.0.21", body: "openai notes" }
                    ]),
                    stderr: "",
                    exitCode: 0
                };
            })
        );

        const result = await resolver.resolve("@ai-sdk/anthropic", "https://github.com/vercel/ai", [
            "4.0.21"
        ]);

        expect(result.size).toBe(0);
    });

    it("returns an empty map when the API response is not valid JSON", async () => {
        const resolver = new GitHubReleasesResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                return { stdout: "not json", stderr: "", exitCode: 0 };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0"
        ]);

        expect(result.size).toBe(0);
    });
});
