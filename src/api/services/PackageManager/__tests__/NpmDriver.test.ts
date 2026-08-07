import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";
import { NpmDriver as NpmDriverRegistration } from "../NpmDriver.js";

describe("NpmDriver", () => {
    function createDriver(): PackageManagerDriver.Interface {
        const container = createContainer();
        container.register(NpmDriverRegistration);
        return container.resolve(PackageManagerDriver);
    }

    it("has id 'npm' and lockfileName 'package-lock.json'", () => {
        const driver = createDriver();
        expect(driver.id).toBe("npm");
        expect(driver.lockfileName).toBe("package-lock.json");
    });

    it("versionCommand returns npm --version", () => {
        const driver = createDriver();
        expect(driver.versionCommand()).toEqual({ command: "npm", args: ["--version"] });
    });

    it("updateVersionCommand returns npm install -g npm@<ver>", () => {
        const driver = createDriver();
        expect(driver.updateVersionCommand("10.9.0")).toEqual({
            command: "npm",
            args: ["install", "-g", "npm@10.9.0"]
        });
    });

    it("upgradePackageCommand returns npm install <name>@<ver>", () => {
        const driver = createDriver();
        expect(driver.upgradePackageCommand("react", "19.0.0")).toEqual({
            command: "npm",
            args: ["install", "react@19.0.0"]
        });
    });

    it("refreshTransientCommand returns npm update", () => {
        const driver = createDriver();
        expect(driver.refreshTransientCommand()).toEqual({
            command: "npm",
            args: ["update"]
        });
    });

    it("installedVersionsCommand returns npm ls --all --json", () => {
        const driver = createDriver();
        expect(driver.installedVersionsCommand()).toEqual({
            command: "npm",
            args: ["ls", "--all", "--json"]
        });
    });

    it("parseInstalledVersions walks dependency tree BFS (shallowest wins)", () => {
        const driver = createDriver();
        const stdout = JSON.stringify({
            dependencies: {
                react: {
                    version: "18.2.0",
                    dependencies: {
                        "loose-envify": { version: "1.4.0" }
                    }
                },
                lodash: { version: "4.17.21" }
            }
        });

        const result = driver.parseInstalledVersions(stdout);
        expect(result.get("react")).toBe("18.2.0");
        expect(result.get("lodash")).toBe("4.17.21");
        expect(result.get("loose-envify")).toBe("1.4.0");
        expect(result.size).toBe(3);
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

    it("parseWorkspaces returns empty array (npm uses package.json path)", () => {
        const driver = createDriver();
        expect(driver.parseWorkspaces("")).toEqual([]);
    });

    it("registryInfoCommand returns npm view <pkg> --json", () => {
        const driver = createDriver();
        expect(driver.registryInfoCommand("react")).toEqual({
            command: "npm",
            args: ["view", "react", "--json"]
        });
    });

    it("registryInfoCommand appends --registry when a registry URL is provided", () => {
        const driver = createDriver();
        expect(driver.registryInfoCommand("react", "https://registry.example.com")).toEqual({
            command: "npm",
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
        expect(result.versions).toEqual(["18.0.0", "19.0.0"]);
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

    it("parseRegistryInfo returns null repoUrl when repository field is absent", () => {
        const driver = createDriver();
        const stdout = JSON.stringify({
            "dist-tags": { latest: "19.0.0" },
            versions: ["18.0.0", "19.0.0"]
        });

        const result = driver.parseRegistryInfo(stdout);
        expect(result.repoUrl).toBeNull();
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

    it("parseRegistryInfo returns null readme when absent", () => {
        const driver = createDriver();
        const stdout = JSON.stringify({
            "dist-tags": { latest: "19.0.0" },
            versions: ["18.0.0", "19.0.0"]
        });

        const result = driver.parseRegistryInfo(stdout);
        expect(result.readme).toBeNull();
    });

    describe("installFlags", () => {
        it("should return npm install flags", () => {
            const driver = createDriver();
            const flags = driver.installFlags();
            expect(flags.length).toBeGreaterThan(0);
            expect(flags.every(f => f.flag.startsWith("--"))).toBe(true);
            expect(flags.map(f => f.flag)).toContain("--force");
        });
    });

    describe("installCommand", () => {
        it("should return npm install with no flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand([]);
            expect(cmd.command).toBe("npm");
            expect(cmd.args).toEqual(["install"]);
        });

        it("should return npm install with flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand(["--force", "--ignore-scripts"]);
            expect(cmd.command).toBe("npm");
            expect(cmd.args).toEqual(["install", "--force", "--ignore-scripts"]);
        });
    });
});
