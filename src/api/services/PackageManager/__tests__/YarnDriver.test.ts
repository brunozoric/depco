import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";
import { YarnDriver as YarnDriverRegistration } from "../drivers/YarnDriver.js";

describe("YarnDriver", () => {
    function createDriver(): PackageManagerDriver.Interface {
        const { container } = createTestApiContainer();
        container.register(YarnDriverRegistration);
        return container.resolve(PackageManagerDriver);
    }

    it("has id 'yarn' and lockfileName 'yarn.lock'", () => {
        const driver = createDriver();
        expect(driver.id).toBe("yarn");
        expect(driver.lockfileName).toBe("yarn.lock");
    });

    it("versionCommand returns yarn --version", () => {
        const driver = createDriver();
        expect(driver.versionCommand()).toEqual({ command: "yarn", args: ["--version"] });
    });

    it("updateVersionCommand returns yarn set version <ver>", () => {
        const driver = createDriver();
        expect(driver.updateVersionCommand("4.7.0")).toEqual({
            command: "yarn",
            args: ["set", "version", "4.7.0"]
        });
    });

    it("upgradePackageCommand returns yarn up <name>@<ver>", () => {
        const driver = createDriver();
        expect(driver.upgradePackageCommand("react", "19.0.0")).toEqual({
            command: "yarn",
            args: ["up", "react@19.0.0"]
        });
    });

    it("refreshTransientCommand returns yarn up ** -R", () => {
        const driver = createDriver();
        expect(driver.refreshTransientCommand()).toEqual({
            command: "yarn",
            args: ["up", "**", "-R"]
        });
    });

    it("installedVersionsCommand returns yarn info --all --json", () => {
        const driver = createDriver();
        expect(driver.installedVersionsCommand()).toEqual({
            command: "yarn",
            args: ["info", "--all", "--json"]
        });
    });

    it("parseInstalledVersions extracts name and version from yarn info JSON lines", () => {
        const driver = createDriver();
        const stdout = [
            '{"value":"react@npm:18.2.0","children":{"Version":"18.2.0"}}',
            '{"value":"lodash@npm:4.17.21","children":{"Version":"4.17.21"}}',
            '{"value":"@scope/pkg@npm:1.0.0","children":{"Version":"1.0.0"}}',
            "",
            "not-json"
        ].join("\n");

        const result = driver.parseInstalledVersions(stdout);
        expect(result.get("react")).toBe("18.2.0");
        expect(result.get("lodash")).toBe("4.17.21");
        expect(result.get("@scope/pkg")).toBe("1.0.0");
        expect(result.size).toBe(3);
    });

    it("workspacesCommand returns yarn workspaces list --json", () => {
        const driver = createDriver();
        expect(driver.workspacesCommand()).toEqual({
            command: "yarn",
            args: ["workspaces", "list", "--json"]
        });
    });

    it("parseWorkspaces extracts location from JSON lines", () => {
        const driver = createDriver();
        const stdout = [
            '{"location":"."}',
            '{"location":"packages/core"}',
            '{"location":"packages/utils"}',
            "",
            "not-json"
        ].join("\n");

        const result = driver.parseWorkspaces(stdout);
        expect(result).toEqual([
            { location: "." },
            { location: "packages/core" },
            { location: "packages/utils" }
        ]);
    });

    it("registryInfoCommand returns yarn npm info <pkg> --json", () => {
        const driver = createDriver();
        expect(driver.registryInfoCommand("react")).toEqual({
            command: "yarn",
            args: ["npm", "info", "react", "--json"]
        });
    });

    it("registryInfoCommand appends --registry when a registry URL is provided", () => {
        const driver = createDriver();
        expect(driver.registryInfoCommand("react", "https://registry.example.com")).toEqual({
            command: "yarn",
            args: ["npm", "info", "react", "--json", "--registry", "https://registry.example.com"]
        });
    });

    it("parseRegistryInfo extracts name, latestVersion, distTags, versions", () => {
        const driver = createDriver();
        const stdout = JSON.stringify({
            "dist-tags": { latest: "19.0.0", next: "20.0.0-alpha" },
            versions: ["18.0.0", "18.2.0", "19.0.0"]
        });

        const result = driver.parseRegistryInfo(stdout);
        expect(result.name).toBe("");
        expect(result.latestVersion).toBe("19.0.0");
        expect(result.distTags).toEqual({ latest: "19.0.0", next: "20.0.0-alpha" });
        expect(result.versions).toEqual(["18.0.0", "18.2.0", "19.0.0"]);
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
        it("should return yarn install flags", () => {
            const driver = createDriver();
            const flags = driver.installFlags();
            expect(flags.length).toBeGreaterThan(0);
            expect(flags.every(f => f.flag.startsWith("--"))).toBe(true);
            expect(flags.map(f => f.flag)).toContain("--force");
        });
    });

    describe("installCommand", () => {
        it("should return yarn install with no flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand([]);
            expect(cmd.command).toBe("yarn");
            expect(cmd.args).toEqual(["install"]);
        });

        it("should return yarn install with flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand(["--force", "--ignore-scripts"]);
            expect(cmd.command).toBe("yarn");
            expect(cmd.args).toEqual(["install", "--force", "--ignore-scripts"]);
        });
    });
});
