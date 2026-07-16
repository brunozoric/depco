import { ChangelogResolver as Abstraction } from "./abstractions/ChangelogResolver.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { extractOwnerRepo } from "./extractOwnerRepo.js";

interface IGitHubRelease {
    tag_name: string;
    body: string | null;
}

class GitHubReleasesResolverImpl implements Abstraction.Interface {
    public readonly name = "github-releases";

    public constructor(private readonly commandRunner: CommandRunner.Interface) {}

    public async resolve(
        packageName: string,
        repoUrl: string | null,
        versions: string[],
        _repoDirectory?: string | null
    ): Promise<Map<string, string>> {
        if (!repoUrl) {
            return new Map();
        }

        const ownerRepo = extractOwnerRepo(repoUrl);
        if (!ownerRepo) {
            return new Map();
        }

        try {
            const versionCheck = await this.commandRunner.run("gh", ["--version"], {
                cwd: process.cwd()
            });
            if (versionCheck.exitCode !== 0) {
                return new Map();
            }
        } catch {
            return new Map();
        }

        try {
            const result = await this.commandRunner.run(
                "gh",
                ["api", `repos/${ownerRepo}/releases`, "--paginate"],
                { cwd: process.cwd() }
            );

            if (result.exitCode !== 0) {
                return new Map();
            }

            const releases = JSON.parse(result.stdout) as IGitHubRelease[];
            const versionSet = new Set(versions);
            const found = new Map<string, string>();

            for (const release of releases) {
                if (!release.body) {
                    continue;
                }
                const tag = release.tag_name;

                // Single-package repo: v4.0.21 or 4.0.21
                const stripped = tag.replace(/^v/i, "");
                if (versionSet.has(stripped)) {
                    found.set(stripped, release.body);
                    continue;
                }

                // Monorepo: packageName@version (e.g. @ai-sdk/anthropic@4.0.21)
                const lastAt = tag.lastIndexOf("@");
                if (lastAt > 0) {
                    const tagPackage = tag.substring(0, lastAt);
                    const tagVersion = tag.substring(lastAt + 1).replace(/^v/i, "");
                    if (tagPackage === packageName && versionSet.has(tagVersion)) {
                        found.set(tagVersion, release.body);
                    }
                }
            }

            return found;
        } catch {
            return new Map();
        }
    }
}

export const GitHubReleasesResolver = Abstraction.createImplementation({
    implementation: GitHubReleasesResolverImpl,
    dependencies: [CommandRunner]
});
