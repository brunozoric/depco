import { describe, it, expect } from "vitest";
import { buildChangelogPaths, CHANGELOG_FILES } from "../changelogPaths.js";

describe("buildChangelogPaths", () => {
    it("returns only root changelog files for an unscoped package", () => {
        const paths = buildChangelogPaths({ packageName: "lodash" });

        expect(paths).toEqual(CHANGELOG_FILES);
    });

    it("prepends repoDirectory paths when provided", () => {
        const paths = buildChangelogPaths({
            packageName: "lodash",
            repoDirectory: "packages/lodash"
        });

        expect(paths[0]).toBe("packages/lodash/CHANGELOG.md");
        expect(paths[1]).toBe("packages/lodash/CHANGES.md");
        expect(paths[2]).toBe("packages/lodash/History.md");
        expect(paths.slice(3)).toEqual(CHANGELOG_FILES);
    });

    it("adds monorepo directory paths for scoped packages", () => {
        const paths = buildChangelogPaths({ packageName: "@babel/core" });

        expect(paths).toContain("packages/core/CHANGELOG.md");
        expect(paths).toContain("libs/core/CHANGELOG.md");
        expect(paths).toContain("apps/core/CHANGELOG.md");
        expect(paths).toContain("modules/core/CHANGELOG.md");
        expect(paths).toContain("plugins/core/CHANGELOG.md");
    });

    it("includes all changelog file variants for each monorepo directory", () => {
        const paths = buildChangelogPaths({ packageName: "@scope/utils" });

        expect(paths).toContain("packages/utils/CHANGELOG.md");
        expect(paths).toContain("packages/utils/CHANGES.md");
        expect(paths).toContain("packages/utils/History.md");
        expect(paths).toContain("libs/utils/CHANGELOG.md");
        expect(paths).toContain("libs/utils/CHANGES.md");
        expect(paths).toContain("libs/utils/History.md");
    });

    it("prioritizes repoDirectory over root and monorepo paths", () => {
        const paths = buildChangelogPaths({
            packageName: "@babel/core",
            repoDirectory: "custom/path"
        });

        expect(paths[0]).toBe("custom/path/CHANGELOG.md");
        expect(paths[1]).toBe("custom/path/CHANGES.md");
        expect(paths[2]).toBe("custom/path/History.md");
        expect(paths[3]).toBe("CHANGELOG.md");
    });

    it("does not add monorepo paths for unscoped packages", () => {
        const paths = buildChangelogPaths({ packageName: "react" });

        const monorepoPath = paths.find(path => path.startsWith("packages/"));
        expect(monorepoPath).toBeUndefined();
    });

    it("handles null repoDirectory the same as undefined", () => {
        const pathsNull = buildChangelogPaths({ packageName: "lodash", repoDirectory: null });
        const pathsUndefined = buildChangelogPaths({ packageName: "lodash" });

        expect(pathsNull).toEqual(pathsUndefined);
    });

    it("handles empty string repoDirectory the same as undefined", () => {
        const paths = buildChangelogPaths({ packageName: "lodash", repoDirectory: "" });

        expect(paths).toEqual(CHANGELOG_FILES);
    });
});
