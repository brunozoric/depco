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

    it("has release script that builds and publishes", () => {
        expect(packageJson.scripts?.["release"]).toBeDefined();
        expect(packageJson.scripts?.["release"]).toContain("yarn build");
        expect(packageJson.scripts?.["release"]).toContain("changeset publish");
    });

    it("has changeset script for adding changesets", () => {
        expect(packageJson.scripts?.["changeset"]).toBe("changeset");
    });

    it("version starts at 0.0.0 (first changeset bumps to 0.0.1)", () => {
        expect(packageJson.version).toBe("0.0.0");
    });
});

describe("publish workflow", () => {
    it("publish workflow file exists", () => {
        expect(existsSync(resolve(ROOT, ".github/workflows/publish.yml"))).toBe(true);
    });

    it("publish workflow triggers after CI success on main", () => {
        const content = readFileSync(resolve(ROOT, ".github/workflows/publish.yml"), "utf-8");

        expect(content).toContain("workflow_run");
        expect(content).toContain("workflows: [CI]");
        expect(content).toContain("branches: [main]");
        expect(content).toContain("types: [completed]");
    });

    it("publish workflow uses changesets/action", () => {
        const content = readFileSync(resolve(ROOT, ".github/workflows/publish.yml"), "utf-8");

        expect(content).toContain("changesets/action@");
        expect(content).toContain("publish: yarn release");
    });

    it("publish workflow requires NPM_TOKEN and GITHUB_TOKEN", () => {
        const content = readFileSync(resolve(ROOT, ".github/workflows/publish.yml"), "utf-8");

        expect(content).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
        expect(content).toContain("NPM_TOKEN: ${{ secrets.NPM_TOKEN }}");
    });

    it("publish workflow has concurrency guard", () => {
        const content = readFileSync(resolve(ROOT, ".github/workflows/publish.yml"), "utf-8");

        expect(content).toContain("concurrency:");
        expect(content).toContain("cancel-in-progress: false");
    });
});
