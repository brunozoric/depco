import { PackageManagerDriver as Abstraction } from "../abstractions/PackageManagerDriver.js";
import { parseRegistryOutput } from "../registrySchema.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import { BUN_INSTALL_FLAGS } from "#shared/install/bun.js";

class BunDriverImpl implements Abstraction.Interface {
    public readonly id = "bun" as const;
    public readonly lockfileName = "bun.lock";

    public versionCommand(): Abstraction.CommandSpec {
        return { command: "bun", args: ["--version"] };
    }

    public updateVersionCommand(version: string): Abstraction.CommandSpec {
        return { command: "bun", args: ["upgrade", "--to", version] };
    }

    public installedVersionsCommand(): Abstraction.CommandSpec {
        return { command: "bun", args: ["pm", "ls", "--all"] };
    }

    public parseInstalledVersions(stdout: string): Map<string, string> {
        const versions = new Map<string, string>();

        for (const line of stdout.split("\n")) {
            if (!/[├└│]/.test(line)) {
                continue;
            }

            const match = line.match(/(@?[^@\s]+)@(\d[^\s]*)/);
            if (match && match[1] && match[2] && !versions.has(match[1])) {
                versions.set(match[1], match[2]);
            }
        }

        return versions;
    }

    public workspacesCommand(): Abstraction.CommandSpec | null {
        return null;
    }

    public parseWorkspaces(_stdout: string): Abstraction.WorkspaceEntry[] {
        return [];
    }

    public upgradePackageCommand(
        packageName: string,
        targetVersion: string
    ): Abstraction.CommandSpec {
        return { command: "bun", args: ["add", `${packageName}@${targetVersion}`] };
    }

    public refreshTransientCommand(packageNames?: string[]): Abstraction.CommandSpec {
        const targets = packageNames && packageNames.length > 0 ? packageNames : [];
        return { command: "bun", args: ["update", ...targets] };
    }

    public registryInfoCommand(packageName: string, registryUrl?: string): Abstraction.CommandSpec {
        const args = ["view", packageName, "--json"];
        if (registryUrl) {
            args.push("--registry", registryUrl);
        }
        return { command: "npm", args };
    }

    public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
        return parseRegistryOutput(stdout);
    }

    public installFlags(): IInstallFlagDefinition[] {
        return BUN_INSTALL_FLAGS;
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "bun", args: ["install", ...flags] };
    }

    public auditCommand(): Abstraction.CommandSpec {
        return { command: "bun", args: ["audit", "--json"] };
    }
}

export const BunDriver = Abstraction.createImplementation({
    implementation: BunDriverImpl,
    dependencies: []
});
