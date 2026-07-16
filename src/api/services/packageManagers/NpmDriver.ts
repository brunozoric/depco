import { PackageManagerDriver as Abstraction } from "./abstractions/PackageManagerDriver.js";
import { normalizeRepoUrl, extractRepoDirectory } from "./normalizeRepoUrl.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import { NPM_INSTALL_FLAGS } from "#shared/install/npm.js";

interface INpmLsEntry {
    version?: string;
    dependencies?: Record<string, INpmLsEntry>;
}

interface INpmLsOutput {
    dependencies?: Record<string, INpmLsEntry>;
}

class NpmDriverImpl implements Abstraction.Interface {
    public readonly id = "npm" as const;
    public readonly lockfileName = "package-lock.json";

    public versionCommand(): Abstraction.CommandSpec {
        return { command: "npm", args: ["--version"] };
    }

    public updateVersionCommand(version: string): Abstraction.CommandSpec {
        return { command: "npm", args: ["install", "-g", `npm@${version}`] };
    }

    public installedVersionsCommand(): Abstraction.CommandSpec {
        return { command: "npm", args: ["ls", "--all", "--json"] };
    }

    public parseInstalledVersions(stdout: string): Map<string, string> {
        const versions = new Map<string, string>();

        let output: INpmLsOutput;
        try {
            output = JSON.parse(stdout) as INpmLsOutput;
        } catch {
            return versions;
        }

        const queue: Record<string, INpmLsEntry>[] = [];
        if (output.dependencies) {
            queue.push(output.dependencies);
        }

        while (queue.length > 0) {
            const level = queue.shift()!;
            for (const [name, entry] of Object.entries(level)) {
                if (entry.version && !versions.has(name)) {
                    versions.set(name, entry.version);
                }
                if (entry.dependencies) {
                    queue.push(entry.dependencies);
                }
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
        return { command: "npm", args: ["install", `${packageName}@${targetVersion}`] };
    }

    public refreshTransientCommand(packageNames?: string[]): Abstraction.CommandSpec {
        const targets = packageNames && packageNames.length > 0 ? packageNames : [];
        return { command: "npm", args: ["update", ...targets] };
    }

    public registryInfoCommand(packageName: string, registryUrl?: string): Abstraction.CommandSpec {
        const args = ["view", packageName, "--json"];
        if (registryUrl) {
            args.push("--registry", registryUrl);
        }
        return { command: "npm", args };
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
        return NPM_INSTALL_FLAGS;
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "npm", args: ["install", ...flags] };
    }

    public auditCommand(): Abstraction.CommandSpec {
        return { command: "npm", args: ["audit", "--json"] };
    }
}

export const NpmDriver = Abstraction.createImplementation({
    implementation: NpmDriverImpl,
    dependencies: []
});
