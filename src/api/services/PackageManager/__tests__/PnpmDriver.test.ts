import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";
import { PnpmDriver as PnpmDriverRegistration } from "../drivers/PnpmDriver.js";

describe("PnpmDriver", () => {
    function createDriver(): PackageManagerDriver.Interface {
        const container = createContainer();
        container.register(PnpmDriverRegistration);
        return container.resolve(PackageManagerDriver);
    }

    it("has id 'pnpm' and lockfileName 'pnpm-lock.yaml'", () => {
        const driver = createDriver();
        expect(driver.id).toBe("pnpm");
        expect(driver.lockfileName).toBe("pnpm-lock.yaml");
    });

    it("versionCommand returns pnpm --version", () => {
        const driver = createDriver();
        expect(driver.versionCommand()).toEqual({ command: "pnpm", args: ["--version"] });
    });

    it("updateVersionCommand returns pnpm add -g pnpm@<ver>", () => {
        const driver = createDriver();
        expect(driver.updateVersionCommand("9.5.0")).toEqual({
            command: "pnpm",
            args: ["add", "-g", "pnpm@9.5.0"]
        });
    });

    it("upgradePackageCommand returns pnpm update <name>@<ver>", () => {
        const driver = createDriver();
        expect(driver.upgradePackageCommand("react", "19.0.0")).toEqual({
            command: "pnpm",
            args: ["update", "react@19.0.0"]
        });
    });

    it("refreshTransientCommand returns pnpm update", () => {
        const driver = createDriver();
        expect(driver.refreshTransientCommand()).toEqual({
            command: "pnpm",
            args: ["update"]
        });
    });

    it("installedVersionsCommand returns pnpm list --json", () => {
        const driver = createDriver();
        expect(driver.installedVersionsCommand()).toEqual({
            command: "pnpm",
            args: ["list", "--json"]
        });
    });

    it("parseInstalledVersions extracts from pnpm list JSON array", () => {
        const driver = createDriver();
        const stdout = JSON.stringify([
            {
                dependencies: { react: { version: "18.2.0" } },
                devDependencies: { vitest: { version: "4.1.0" } }
            }
        ]);

        const result = driver.parseInstalledVersions(stdout);
        expect(result.get("react")).toBe("18.2.0");
        expect(result.get("vitest")).toBe("4.1.0");
        expect(result.size).toBe(2);
    });

    it("parseInstalledVersions returns empty map for invalid JSON", () => {
        const driver = createDriver();
        const result = driver.parseInstalledVersions("not json");
        expect(result.size).toBe(0);
    });

    it("workspacesCommand returns null (uses package.json)", () => {
        const driver = createDriver();
        expect(driver.workspacesCommand()).toBeNull();
    });

    it("parseWorkspaces returns empty array", () => {
        const driver = createDriver();
        expect(driver.parseWorkspaces("")).toEqual([]);
    });

    it("registryInfoCommand returns pnpm view <pkg> --json", () => {
        const driver = createDriver();
        expect(driver.registryInfoCommand("react")).toEqual({
            command: "pnpm",
            args: ["view", "react", "--json"]
        });
    });

    it("registryInfoCommand appends --registry when a registry URL is provided", () => {
        const driver = createDriver();
        expect(driver.registryInfoCommand("react", "https://registry.example.com")).toEqual({
            command: "pnpm",
            args: ["view", "react", "--json", "--registry", "https://registry.example.com"]
        });
    });

    it("parseRegistryInfo extracts dist-tags and versions", () => {
        const driver = createDriver();
        const stdout = JSON.stringify({
            "dist-tags": { latest: "19.0.0" },
            versions: ["18.0.0", "19.0.0"]
        });

        const result = driver.parseRegistryInfo(stdout);
        expect(result.latestVersion).toBe("19.0.0");
    });

    it("parseRegistryInfo extracts and normalizes repoUrl from the repository field", () => {
        const driver = createDriver();
        const stdout = JSON.stringify({
            "dist-tags": { latest: "19.0.0" },
            versions: ["18.0.0", "19.0.0"],
            repository: { type: "git", url: "git+https://github.com/org/repo.git" }
        });

        const result = driver.parseRegistryInfo(stdout);
        expect(result.repoUrl).toBe("https://github.com/org/repo");
    });

    it("parseRegistryInfo extracts readme when present", () => {
        const driver = createDriver();
        const stdout = JSON.stringify({
            "dist-tags": { latest: "19.0.0" },
            versions: ["18.0.0", "19.0.0"],
            readme: "# My Package"
        });

        const result = driver.parseRegistryInfo(stdout);
        expect(result.readme).toBe("# My Package");
    });

    describe("installFlags", () => {
        it("should return pnpm install flags", () => {
            const driver = createDriver();
            const flags = driver.installFlags();
            expect(flags.length).toBeGreaterThan(0);
            expect(flags.every(f => f.flag.startsWith("--"))).toBe(true);
            expect(flags.map(f => f.flag)).toContain("--force");
        });
    });

    describe("installCommand", () => {
        it("should return pnpm install with no flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand([]);
            expect(cmd.command).toBe("pnpm");
            expect(cmd.args).toEqual(["install"]);
        });

        it("should return pnpm install with flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand(["--force", "--ignore-scripts"]);
            expect(cmd.command).toBe("pnpm");
            expect(cmd.args).toEqual(["install", "--force", "--ignore-scripts"]);
        });
    });
});
