import { z } from "zod";
import { ChangelogResolver as Abstraction } from "./abstractions/ChangelogResolver.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { extractOwnerRepo } from "./extractOwnerRepo.js";
import { parseVersionSections } from "./parseVersionSections.js";

const githubContentsSchema = z.object({
    content: z.string().optional(),
    encoding: z.string().optional()
});

const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];

class ChangelogFileResolverImpl implements Abstraction.Interface {
    public readonly name = "changelog-file";

    public constructor(private readonly commandRunner: CommandRunner.Interface) {}

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
            const versionCheck = await this.commandRunner.run("gh", ["--version"], {
                cwd: process.cwd()
            });
            if (versionCheck.exitCode !== 0) {
                return new Map();
            }
        } catch {
            return new Map();
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

        for (const filename of paths) {
            try {
                const result = await this.commandRunner.run(
                    "gh",
                    ["api", `repos/${ownerRepo}/contents/${filename}`],
                    { cwd: process.cwd() }
                );

                if (result.exitCode !== 0) {
                    continue;
                }

                const response = githubContentsSchema.parse(JSON.parse(result.stdout));
                if (response.content && response.encoding === "base64") {
                    const decoded = Buffer.from(response.content, "base64").toString("utf-8");
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
    }
}

export const ChangelogFileResolver = Abstraction.createImplementation({
    implementation: ChangelogFileResolverImpl,
    dependencies: [CommandRunner]
});
