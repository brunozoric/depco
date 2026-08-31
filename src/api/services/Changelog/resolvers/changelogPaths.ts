export const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];

const MONOREPO_DIRECTORIES = ["packages", "libs", "apps", "modules", "plugins"];

export function buildChangelogPaths(input: {
    packageName: string;
    repoDirectory?: string | null | undefined;
}): string[] {
    const { packageName, repoDirectory } = input;
    const paths: string[] = [];

    if (repoDirectory) {
        for (const filename of CHANGELOG_FILES) {
            paths.push(`${repoDirectory}/${filename}`);
        }
    }

    paths.push(...CHANGELOG_FILES);

    const unscoped = packageName.startsWith("@") ? packageName.split("/")[1] : undefined;

    if (unscoped) {
        for (const directory of MONOREPO_DIRECTORIES) {
            for (const filename of CHANGELOG_FILES) {
                paths.push(`${directory}/${unscoped}/${filename}`);
            }
        }
    }

    return paths;
}
