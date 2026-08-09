import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { PackageManagerDriver } from "../abstractions/PackageManagerDriver.js";
import { BunDriver as BunDriverRegistration } from "../drivers/BunDriver.js";

describe("BunDriver", () => {
    function createDriver(): PackageManagerDriver.Interface {
        const container = createContainer();
        container.register(BunDriverRegistration);
        return container.resolve(PackageManagerDriver);
    }

    it("has id 'bun' and lockfileName 'bun.lock'", () => {
        const driver = createDriver();
        expect(driver.id).toBe("bun");
        expect(driver.lockfileName).toBe("bun.lock");
    });

    it("versionCommand returns bun --version", () => {
        const driver = createDriver();
        expect(driver.versionCommand()).toEqual({ command: "bun", args: ["--version"] });
    });

    it("updateVersionCommand returns bun upgrade --to <ver>", () => {
        const driver = createDriver();
        expect(driver.updateVersionCommand("1.2.0")).toEqual({
            command: "bun",
            args: ["upgrade", "--to", "1.2.0"]
        });
    });

    it("upgradePackageCommand returns bun add <name>@<ver>", () => {
        const driver = createDriver();
        expect(driver.upgradePackageCommand("react", "19.0.0")).toEqual({
            command: "bun",
            args: ["add", "react@19.0.0"]
        });
    });

    it("refreshTransientCommand returns bun update", () => {
        const driver = createDriver();
        expect(driver.refreshTransientCommand()).toEqual({
            command: "bun",
            args: ["update"]
        });
    });

    it("installedVersionsCommand returns bun pm ls --all", () => {
        const driver = createDriver();
        expect(driver.installedVersionsCommand()).toEqual({
            command: "bun",
            args: ["pm", "ls", "--all"]
        });
    });

    it("parseInstalledVersions extracts packages from tree output", () => {
        const driver = createDriver();
        const stdout = [
            "my-app@1.0.0 /path/to/project",
            "├── react@18.2.0",
            "├── react-dom@18.2.0",
            "│   └── loose-envify@1.4.0",
            "└── typescript@5.0.0"
        ].join("\n");

        const result = driver.parseInstalledVersions(stdout);
        expect(result.get("react")).toBe("18.2.0");
        expect(result.get("react-dom")).toBe("18.2.0");
        expect(result.get("loose-envify")).toBe("1.4.0");
        expect(result.get("typescript")).toBe("5.0.0");
        expect(result.size).toBe(4);
    });

    it("parseInstalledVersions handles scoped packages", () => {
        const driver = createDriver();
        const stdout = [
            "my-app@1.0.0 /path/to/project",
            "├── @babel/core@7.24.0",
            "└── @types/react@18.2.0"
        ].join("\n");

        const result = driver.parseInstalledVersions(stdout);
        expect(result.get("@babel/core")).toBe("7.24.0");
        expect(result.get("@types/react")).toBe("18.2.0");
    });

    it("parseInstalledVersions keeps first occurrence (shallowest wins)", () => {
        const driver = createDriver();
        const stdout = [
            "my-app@1.0.0 /path/to/project",
            "├── react@18.2.0",
            "│   └── react@17.0.0"
        ].join("\n");

        const result = driver.parseInstalledVersions(stdout);
        expect(result.get("react")).toBe("18.2.0");
    });

    it("parseInstalledVersions returns empty map for empty output", () => {
        const driver = createDriver();
        const result = driver.parseInstalledVersions("");
        expect(result.size).toBe(0);
    });

    it("workspacesCommand returns null", () => {
        const driver = createDriver();
        expect(driver.workspacesCommand()).toBeNull();
    });

    it("parseWorkspaces returns empty array", () => {
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
        it("should return bun install flags", () => {
            const driver = createDriver();
            const flags = driver.installFlags();
            expect(flags.length).toBeGreaterThan(0);
            expect(flags.every(f => f.flag.startsWith("--"))).toBe(true);
            expect(flags.map(f => f.flag)).toContain("--force");
        });
    });

    describe("installCommand", () => {
        it("should return bun install with no flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand([]);
            expect(cmd.command).toBe("bun");
            expect(cmd.args).toEqual(["install"]);
        });

        it("should return bun install with flags", () => {
            const driver = createDriver();
            const cmd = driver.installCommand(["--force", "--ignore-scripts"]);
            expect(cmd.command).toBe("bun");
            expect(cmd.args).toEqual(["install", "--force", "--ignore-scripts"]);
        });
    });
});
