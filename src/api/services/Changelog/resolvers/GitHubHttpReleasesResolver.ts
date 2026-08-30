import { formatZodError } from "#shared/index.js";
import { ChangelogResolver as Abstraction } from "../abstractions/ChangelogResolver.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { extractOwnerRepo } from "../extractOwnerRepo.js";
import { readGitHubToken } from "./readGitHubToken.js";
import { githubReleasesSchema } from "../schemas.js";

class GitHubHttpReleasesResolverImpl implements Abstraction.Interface {
    public readonly name = "github-http-releases";

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly encryptionService: EncryptionService.Interface
    ) {}

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
            const { token } = await readGitHubToken({
                databaseClient: this.databaseClient,
                encryptionService: this.encryptionService
            });

            const headers: Record<string, string> = {
                Accept: "application/vnd.github+json"
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch(
                `https://api.github.com/repos/${ownerRepo}/releases?per_page=100`,
                { headers }
            );

            if (!response.ok) {
                return new Map();
            }

            const parsedReleases = githubReleasesSchema.safeParse(await response.json());
            if (!parsedReleases.success) {
                throw new Error(formatZodError(parsedReleases.error.issues));
            }
            const releases = parsedReleases.data;
            const versionSet = new Set(versions);
            const found = new Map<string, string>();

            for (const release of releases) {
                if (!release.body) {
                    continue;
                }

                const tag = release.tag_name;
                const stripped = tag.replace(/^v/i, "");
                if (versionSet.has(stripped)) {
                    found.set(stripped, release.body);
                    continue;
                }

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

export const GitHubHttpReleasesResolver = Abstraction.createImplementation({
    implementation: GitHubHttpReleasesResolverImpl,
    dependencies: [DatabaseClient, EncryptionService]
});
