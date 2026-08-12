import { ChangelogResolver as Abstraction } from "../abstractions/ChangelogResolver.js";
import { extractOwnerRepo } from "../extractOwnerRepo.js";
import { parseVersionSections } from "../parseVersionSections.js";

const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];
const BRANCHES = ["main", "master"];

interface IFetchChangelogInput {
    ownerRepo: string;
    path: string;
    versions: Set<string>;
}

async function fetchChangelog(input: IFetchChangelogInput): Promise<Map<string, string>> {
    const { ownerRepo, path, versions } = input;

    for (const branch of BRANCHES) {
        try {
            const url = `https://raw.githubusercontent.com/${ownerRepo}/${branch}/${path}`;
            const response = await fetch(url);
            if (!response.ok) {
                continue;
            }
            const body = await response.text();
            const found = parseVersionSections(body, versions);
            if (found.size > 0) {
                return found;
            }
        } catch {
            continue;
        }
    }

    return new Map();
}

class RawGitHubChangelogResolverImpl implements Abstraction.Interface {
    public readonly name = "raw-github-changelog";

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

        for (const path of paths) {
            const found = await fetchChangelog({ ownerRepo, path, versions: versionSet });
            if (found.size > 0) {
                return found;
            }
        }

        return new Map();
    }
}

export const RawGitHubChangelogResolver = Abstraction.createImplementation({
    implementation: RawGitHubChangelogResolverImpl,
    dependencies: []
});
