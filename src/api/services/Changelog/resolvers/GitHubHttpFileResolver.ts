import { z } from "zod";
import { ChangelogResolver as Abstraction } from "../abstractions/ChangelogResolver.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { extractOwnerRepo } from "../extractOwnerRepo.js";
import { parseVersionSections } from "../parseVersionSections.js";
import { readGitHubToken } from "./readGitHubToken.js";

const githubContentsSchema = z.object({
    content: z.string().optional(),
    encoding: z.string().optional()
});

const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];

class GitHubHttpFileResolverImpl implements Abstraction.Interface {
    public readonly name = "github-http-file";

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly encryptionService: EncryptionService.Interface
    ) {}

    public async resolve(
        packageName: string,
        repoUrl: string | null,
        versions: string[],
        repoDirectory?: string | null
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

            const versionSet = new Set(versions);
            const paths: string[] = [];

            if (repoDirectory) {
                for (const filename of CHANGELOG_FILES) {
                    paths.push(`${repoDirectory}/${filename}`);
                }
            }

            paths.push(...CHANGELOG_FILES);

            if (packageName.startsWith("@")) {
                const unscoped = packageName.split("/")[1];
                if (unscoped) {
                    for (const filename of CHANGELOG_FILES) {
                        paths.push(`packages/${unscoped}/${filename}`);
                    }
                }
            }

            for (const filePath of paths) {
                try {
                    const response = await fetch(
                        `https://api.github.com/repos/${ownerRepo}/contents/${filePath}`,
                        { headers }
                    );

                    if (!response.ok) {
                        continue;
                    }

                    const parsedContents = githubContentsSchema.safeParse(await response.json());
                    if (!parsedContents.success) {
                        throw new Error(JSON.stringify(parsedContents.error.issues));
                    }
                    const data = parsedContents.data;
                    if (data.content && data.encoding === "base64") {
                        const decoded = Buffer.from(data.content, "base64").toString("utf-8");
                        const found = parseVersionSections(decoded, versionSet);
                        if (found.size > 0) {
                            return found;
                        }
                    }
                } catch {
                    continue;
                }
            }

            return new Map();
        } catch {
            return new Map();
        }
    }
}

export const GitHubHttpFileResolver = Abstraction.createImplementation({
    implementation: GitHubHttpFileResolverImpl,
    dependencies: [DatabaseClient, EncryptionService]
});
