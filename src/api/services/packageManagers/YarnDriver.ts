import { PackageManagerDriver as Abstraction } from "./abstractions/PackageManagerDriver.js";
import { normalizeRepoUrl, extractRepoDirectory } from "./normalizeRepoUrl.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import { YARN_INSTALL_FLAGS } from "#shared/install/yarn.js";

interface IYarnInfoEntry {
    value?: string;
    children?: { Version?: string };
}

class YarnDriverImpl implements Abstraction.Interface {
    public readonly id = "yarn" as const;
    public readonly lockfileName = "yarn.lock";

    public versionCommand(): Abstraction.CommandSpec {
        return { command: "yarn", args: ["--version"] };
    }

    public updateVersionCommand(version: string): Abstraction.CommandSpec {
        return { command: "yarn", args: ["set", "version", version] };
    }

    public installedVersionsCommand(): Abstraction.CommandSpec {
        return { command: "yarn", args: ["info", "--all", "--json"] };
    }

    public parseInstalledVersions(stdout: string): Map<string, string> {
        const versions = new Map<string, string>();

        for (const line of stdout.split("\n")) {
            if (!line.trim()) {
                continue;
            }

            let entry: IYarnInfoEntry;
            try {
                entry = JSON.parse(line) as IYarnInfoEntry;
            } catch {
                continue;
            }

            if (!entry.value || !entry.children?.Version) {
                continue;
            }

            const atNpmIndex = entry.value.indexOf("@npm:");
            if (atNpmIndex <= 0) {
                continue;
            }

            const name = entry.value.substring(0, atNpmIndex);
            versions.set(name, entry.children.Version);
        }

        return versions;
    }

    public workspacesCommand(): Abstraction.CommandSpec {
        return { command: "yarn", args: ["workspaces", "list", "--json"] };
    }

    public parseWorkspaces(stdout: string): Abstraction.WorkspaceEntry[] {
        const workspaces: Abstraction.WorkspaceEntry[] = [];

        for (const line of stdout.split("\n")) {
            if (!line.trim()) {
                continue;
            }

            try {
                const entry = JSON.parse(line) as Abstraction.WorkspaceEntry;
                if (entry.location) {
                    workspaces.push(entry);
                }
            } catch {
                continue;
            }
        }

        return workspaces;
    }

    public upgradePackageCommand(
        packageName: string,
        targetVersion: string
    ): Abstraction.CommandSpec {
        return { command: "yarn", args: ["up", `${packageName}@${targetVersion}`] };
    }

    public refreshTransientCommand(packageNames?: string[]): Abstraction.CommandSpec {
        const targets = packageNames && packageNames.length > 0 ? packageNames : ["**"];
        return { command: "yarn", args: ["up", ...targets, "-R"] };
    }

    public registryInfoCommand(packageName: string, registryUrl?: string): Abstraction.CommandSpec {
        const args = ["npm", "info", packageName, "--json"];
        if (registryUrl) {
            args.push("--registry", registryUrl);
        }
        return { command: "yarn", args };
    }

    public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
        const raw = JSON.parse(stdout) as Record<string, unknown>;
        const distTags = (raw["dist-tags"] as Record<string, string> | undefined) ?? {};
        return {
            name: "",
            latestVersion: distTags["latest"] ?? "",
            distTags,
            versions: (raw["versions"] as string[] | undefined) ?? [],
            time: (raw["time"] as Record<string, string> | undefined) ?? {},
            repoUrl: normalizeRepoUrl(raw["repository"]),
            repoDirectory: extractRepoDirectory(raw["repository"]),
            readme: (raw["readme"] as string | undefined) ?? null,
            license: (raw["license"] as string | undefined) ?? null
        };
    }

    public installFlags(): IInstallFlagDefinition[] {
        return YARN_INSTALL_FLAGS;
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "yarn", args: ["install", ...flags] };
    }

    public auditCommand(): Abstraction.CommandSpec {
        return { command: "yarn", args: ["npm", "audit", "--recursive", "--json"] };
    }
}

export const YarnDriver = Abstraction.createImplementation({
    implementation: YarnDriverImpl,
    dependencies: []
});
