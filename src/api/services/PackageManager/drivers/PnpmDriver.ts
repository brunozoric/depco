import { z } from "zod";
import { PackageManagerDriver as Abstraction } from "../abstractions/PackageManagerDriver.js";
import { parseRegistryOutput } from "../registrySchema.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import { PNPM_INSTALL_FLAGS } from "#shared/install/pnpm.js";

interface IPnpmVersionEntry {
    version?: string;
}

interface IPnpmListEntry {
    dependencies?: Record<string, IPnpmVersionEntry>;
    devDependencies?: Record<string, IPnpmVersionEntry>;
}

const pnpmVersionRecord = z.record(z.string(), z.object({ version: z.string().optional() }));

const pnpmListEntrySchema = z.object({
    dependencies: pnpmVersionRecord.optional(),
    devDependencies: pnpmVersionRecord.optional()
});

class PnpmDriverImpl implements Abstraction.Interface {
    public readonly id = "pnpm" as const;
    public readonly lockfileName = "pnpm-lock.yaml";

    public versionCommand(): Abstraction.CommandSpec {
        return { command: "pnpm", args: ["--version"] };
    }

    public updateVersionCommand(version: string): Abstraction.CommandSpec {
        return { command: "pnpm", args: ["add", "-g", `pnpm@${version}`] };
    }

    public installedVersionsCommand(): Abstraction.CommandSpec {
        return { command: "pnpm", args: ["list", "--json"] };
    }

    public parseInstalledVersions(stdout: string): Map<string, string> {
        const versions = new Map<string, string>();

        let entries: IPnpmListEntry[];
        try {
            const parsedStdout: unknown = JSON.parse(stdout);
            if (Array.isArray(parsedStdout)) {
                const parsedEntries = z.array(pnpmListEntrySchema).safeParse(parsedStdout);
                if (!parsedEntries.success) {
                    throw new Error(JSON.stringify(parsedEntries.error.issues));
                }
                entries = parsedEntries.data as IPnpmListEntry[];
            } else {
                entries = [];
            }
        } catch {
            return versions;
        }

        for (const entry of entries) {
            for (const deps of [entry.dependencies, entry.devDependencies]) {
                for (const [name, info] of Object.entries(deps ?? {})) {
                    if (info.version && !versions.has(name)) {
                        versions.set(name, info.version);
                    }
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
        return { command: "pnpm", args: ["update", `${packageName}@${targetVersion}`] };
    }

    public refreshTransientCommand(packageNames?: string[]): Abstraction.CommandSpec {
        const targets = packageNames && packageNames.length > 0 ? packageNames : [];
        return { command: "pnpm", args: ["update", ...targets] };
    }

    public registryInfoCommand(packageName: string, registryUrl?: string): Abstraction.CommandSpec {
        const args = ["view", packageName, "--json"];
        if (registryUrl) {
            args.push("--registry", registryUrl);
        }
        return { command: "pnpm", args };
    }

    public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
        return parseRegistryOutput(stdout);
    }

    public installFlags(): IInstallFlagDefinition[] {
        return PNPM_INSTALL_FLAGS;
    }

    public installCommand(flags: string[]): Abstraction.CommandSpec {
        return { command: "pnpm", args: ["install", ...flags] };
    }

    public auditCommand(): Abstraction.CommandSpec {
        return { command: "pnpm", args: ["audit", "--json"] };
    }
}

export const PnpmDriver = Abstraction.createImplementation({
    implementation: PnpmDriverImpl,
    dependencies: []
});
