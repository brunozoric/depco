import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");

function readJson<T>(relativePath: string): T {
    const fullPath = resolve(ROOT, relativePath);
    const content = readFileSync(fullPath, "utf-8");
    return JSON.parse(content) as T;
}

interface IChangesetConfig {
    changelog: [string, { repo: string }] | string;
    commit: boolean;
    access: string;
    baseBranch: string;
    fixed: string[][];
    linked: string[][];
    updateInternalDependencies: string;
    ignore: string[];
}

interface IPackageJson {
    name: string;
    version: string;
    publishConfig?: { access?: string };
    repository?: { type: string; url: string };
    files?: string[];
    bin?: string;
    scripts?: Record<string, string>;
}

describe("changeset configuration", () => {
    it("changeset config file exists", () => {
        expect(existsSync(resolve(ROOT, ".changeset/config.json"))).toBe(true);
    });

    it("changeset config has correct settings", () => {
        const config = readJson<IChangesetConfig>(".changeset/config.json");

        expect(config.access).toBe("public");
        expect(config.baseBranch).toBe("main");
        expect(config.commit).toBe(false);
    });

    it("changeset config uses github changelog with correct repo", () => {
        const config = readJson<IChangesetConfig>(".changeset/config.json");

        expect(Array.isArray(config.changelog)).toBe(true);
        const [changelogPackage, changelogOptions] = config.changelog as [string, { repo: string }];
        expect(changelogPackage).toBe("@changesets/changelog-github");
        expect(changelogOptions.repo).toBe("brunozoric/depco");
    });
});

describe("package.json publish configuration", () => {
    const packageJson = readJson<IPackageJson>("package.json");

    it("has public access in publishConfig", () => {
        expect(packageJson.publishConfig?.access).toBe("public");
    });

    it("has repository field pointing to GitHub", () => {
        expect(packageJson.repository).toBeDefined();
        expect(packageJson.repository!.url).toContain("brunozoric/depco");
    });

    it("has files field that includes dist and migrations", () => {
        expect(packageJson.files).toBeDefined();
        expect(packageJson.files).toContain("dist");
        expect(packageJson.files).toContain("src/api/db/migrations");
    });

    it("has bin entry for CLI", () => {
        expect(packageJson.bin).toBe("./dist/cli/index.js");
    });

    it("has changeset scripts", () => {
        expect(packageJson.scripts?.["changeset"]).toBe("changeset");
        expect(packageJson.scripts?.["changeset:version"]).toBe("changeset version");
        expect(packageJson.scripts?.["changeset:publish"]).toBeDefined();
        expect(packageJson.scripts?.["changeset:publish"]).toContain("changeset publish");
    });

    it("has prepublishOnly script that builds", () => {
        expect(packageJson.scripts?.["prepublishOnly"]).toBeDefined();
        expect(packageJson.scripts?.["prepublishOnly"]).toContain("build");
    });

    it("version starts at 0.0.0 (first changeset bumps to 0.0.1)", () => {
        expect(packageJson.version).toBe("0.0.0");
    });
});
