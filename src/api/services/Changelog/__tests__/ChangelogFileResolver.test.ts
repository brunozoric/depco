import { describe, it, expect } from "vitest";
import { ChangelogFileResolver } from "../resolvers/ChangelogFileResolver.js";
import type { CommandRunner } from "../../CommandRunner/index.js";

type RunHandler = CommandRunner.Interface["run"];

function createCommandRunner(runHandler: RunHandler): CommandRunner.Interface {
    return {
        run: runHandler,
        runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    };
}

function toBase64(content: string): string {
    return Buffer.from(content, "utf-8").toString("base64");
}

describe("ChangelogFileResolver", () => {
    it("returns an empty map when repoUrl is null", async () => {
        const resolver = new ChangelogFileResolver(
            createCommandRunner(async () => ({ stdout: "", stderr: "", exitCode: 0 }))
        );

        const result = await resolver.resolve("some-package", null, ["1.0.0"]);

        expect(result.size).toBe(0);
    });

    it("returns an empty map when `gh --version` fails", async () => {
        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "", stderr: "not found", exitCode: 1 };
                }
                return { stdout: "", stderr: "", exitCode: 0 };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("parses base64-encoded CHANGELOG.md content and splits by version headings", async () => {
        const changelogContent = [
            "# Changelog",
            "",
            "## 2.0.0",
            "- breaking change",
            "",
            "## 1.0.0",
            "- initial release"
        ].join("\n");

        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                if (args.some(arg => arg.includes("CHANGELOG.md"))) {
                    return {
                        stdout: JSON.stringify({
                            content: toBase64(changelogContent),
                            encoding: "base64"
                        }),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0",
            "2.0.0"
        ]);

        expect(result.size).toBe(2);
        expect(result.get("2.0.0")).toBe("- breaking change");
        expect(result.get("1.0.0")).toBe("- initial release");
    });

    it("falls back to CHANGES.md when CHANGELOG.md is not found", async () => {
        const changesContent = "## 1.0.0\n- from CHANGES.md";

        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                if (args.some(arg => arg.includes("CHANGELOG.md"))) {
                    return { stdout: "", stderr: "not found", exitCode: 1 };
                }
                if (args.some(arg => arg.includes("CHANGES.md"))) {
                    return {
                        stdout: JSON.stringify({
                            content: toBase64(changesContent),
                            encoding: "base64"
                        }),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0"
        ]);

        expect(result.size).toBe(1);
        expect(result.get("1.0.0")).toBe("- from CHANGES.md");
    });

    it("tries packages/<unscoped>/CHANGELOG.md for scoped packages", async () => {
        const changelogContent = "## 4.0.21\n- monorepo changelog entry";

        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                if (args.some(arg => arg.includes("packages/anthropic/CHANGELOG.md"))) {
                    return {
                        stdout: JSON.stringify({
                            content: toBase64(changelogContent),
                            encoding: "base64"
                        }),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        const result = await resolver.resolve("@ai-sdk/anthropic", "https://github.com/vercel/ai", [
            "4.0.21"
        ]);

        expect(result.size).toBe(1);
        expect(result.get("4.0.21")).toBe("- monorepo changelog entry");
    });

    it("does not try monorepo paths for unscoped packages", async () => {
        const requestedPaths: string[] = [];

        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                const contentArg = args.find(a => a.includes("contents/"));
                if (contentArg) {
                    requestedPaths.push(contentArg);
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        await resolver.resolve("lodash", "https://github.com/lodash/lodash", ["4.0.0"]);

        expect(requestedPaths.every(p => !p.includes("packages/"))).toBe(true);
    });

    it("returns an empty map when no changelog file is found in any candidate", async () => {
        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        const result = await resolver.resolve("some-package", "https://github.com/owner/repo", [
            "1.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("tries repoDirectory paths before root when repoDirectory is provided", async () => {
        const changelogContent = "## 1.0.0\n- monorepo entry";
        const requestedPaths: string[] = [];

        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                const contentArg = args.find(a => a.includes("contents/"));
                if (contentArg) {
                    requestedPaths.push(contentArg);
                }
                if (args.some(arg => arg.includes("packages/core/CHANGELOG.md"))) {
                    return {
                        stdout: JSON.stringify({
                            content: toBase64(changelogContent),
                            encoding: "base64"
                        }),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        const result = await resolver.resolve(
            "some-package",
            "https://github.com/owner/repo",
            ["1.0.0"],
            "packages/core"
        );

        expect(result.size).toBe(1);
        expect(result.get("1.0.0")).toBe("- monorepo entry");
        expect(requestedPaths[0]).toContain("packages/core/CHANGELOG.md");
    });

    it("falls back to root CHANGELOG.md when repoDirectory changelog not found", async () => {
        const rootChangelog = "## 1.0.0\n- root entry";

        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                if (args.some(arg => arg.includes("packages/core/"))) {
                    return { stdout: "", stderr: "not found", exitCode: 1 };
                }
                if (args.some(arg => arg.includes("contents/CHANGELOG.md"))) {
                    return {
                        stdout: JSON.stringify({
                            content: toBase64(rootChangelog),
                            encoding: "base64"
                        }),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        const result = await resolver.resolve(
            "some-package",
            "https://github.com/owner/repo",
            ["1.0.0"],
            "packages/core"
        );

        expect(result.size).toBe(1);
        expect(result.get("1.0.0")).toBe("- root entry");
    });

    it("tries repoDirectory before packages/<unscoped> for scoped packages", async () => {
        const changelogContent = "## 2.0.0\n- scoped monorepo entry";
        const requestedPaths: string[] = [];

        const resolver = new ChangelogFileResolver(
            createCommandRunner(async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                const contentArg = args.find(a => a.includes("contents/"));
                if (contentArg) {
                    requestedPaths.push(contentArg);
                }
                if (args.some(arg => arg.includes("libs/anthropic/CHANGELOG.md"))) {
                    return {
                        stdout: JSON.stringify({
                            content: toBase64(changelogContent),
                            encoding: "base64"
                        }),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            })
        );

        const result = await resolver.resolve(
            "@ai-sdk/anthropic",
            "https://github.com/vercel/ai",
            ["2.0.0"],
            "libs/anthropic"
        );

        expect(result.size).toBe(1);
        expect(result.get("2.0.0")).toBe("- scoped monorepo entry");
        expect(requestedPaths[0]).toContain("libs/anthropic/CHANGELOG.md");
    });
});
