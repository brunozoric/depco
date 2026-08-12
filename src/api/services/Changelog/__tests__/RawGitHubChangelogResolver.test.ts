import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RawGitHubChangelogResolver } from "../resolvers/RawGitHubChangelogResolver.js";

const CHANGELOG_CONTENT = [
    "# Changelog",
    "",
    "## 3.0.0 - 2023-01-15",
    "",
    "### Breaking changes",
    "",
    "- Dropped support for Node 14",
    "",
    "## 2.0.0 - 2022-06-01",
    "",
    "- Added new feature"
].join("\n");

describe("RawGitHubChangelogResolver", () => {
    let resolver: InstanceType<typeof RawGitHubChangelogResolver>;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        resolver = new RawGitHubChangelogResolver();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("has the name 'raw-github-changelog'", () => {
        expect(resolver.name).toBe("raw-github-changelog");
    });

    it("returns empty map when repoUrl is null", async () => {
        const result = await resolver.resolve("some-pkg", null, ["3.0.0"]);
        expect(result.size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns empty map when repoUrl is not a GitHub URL", async () => {
        const result = await resolver.resolve("some-pkg", "https://gitlab.com/owner/repo", [
            "3.0.0"
        ]);
        expect(result.size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches CHANGELOG.md from main branch first", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => CHANGELOG_CONTENT
        });

        const result = await resolver.resolve("some-pkg", "https://github.com/owner/repo", [
            "3.0.0"
        ]);

        expect(result.size).toBe(1);
        expect(result.get("3.0.0")).toContain("Dropped support for Node 14");
        expect(fetchMock).toHaveBeenCalledWith(
            "https://raw.githubusercontent.com/owner/repo/main/CHANGELOG.md"
        );
    });

    it("falls back to master branch when main returns 404", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
            ok: true,
            text: async () => CHANGELOG_CONTENT
        });

        const result = await resolver.resolve("some-pkg", "https://github.com/owner/repo", [
            "3.0.0"
        ]);

        expect(result.size).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "https://raw.githubusercontent.com/owner/repo/master/CHANGELOG.md"
        );
    });

    it("tries repoDirectory path first when provided", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => CHANGELOG_CONTENT
        });

        await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"],
            "packages/core"
        );

        expect(fetchMock).toHaveBeenCalledWith(
            "https://raw.githubusercontent.com/owner/repo/main/packages/core/CHANGELOG.md"
        );
    });

    it("tries scoped package path for @scope/name packages", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("packages/my-lib/CHANGELOG.md") && url.includes("/main/")) {
                return { ok: true, text: async () => CHANGELOG_CONTENT };
            }
            return { ok: false, status: 404 };
        });

        const result = await resolver.resolve("@scope/my-lib", "https://github.com/owner/repo", [
            "3.0.0"
        ]);

        expect(result.size).toBe(1);
    });

    it("returns empty map when all paths return 404", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        const result = await resolver.resolve("some-pkg", "https://github.com/owner/repo", [
            "3.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("returns empty map when fetch throws", async () => {
        fetchMock.mockRejectedValue(new Error("network error"));

        const result = await resolver.resolve("some-pkg", "https://github.com/owner/repo", [
            "3.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("returns empty map when CHANGELOG.md has no matching versions", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => "# Changelog\n\n## 99.0.0\n\nFuture release"
        });

        const result = await resolver.resolve("some-pkg", "https://github.com/owner/repo", [
            "3.0.0"
        ]);

        expect(result.size).toBe(0);
    });

    it("tries CHANGES.md and History.md after CHANGELOG.md", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("CHANGES.md") && url.includes("/main/")) {
                return { ok: true, text: async () => CHANGELOG_CONTENT };
            }
            return { ok: false, status: 404 };
        });

        const result = await resolver.resolve("some-pkg", "https://github.com/owner/repo", [
            "3.0.0"
        ]);

        expect(result.size).toBe(1);
    });
});
