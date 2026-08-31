export const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];

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

    if (packageName.startsWith("@")) {
        const unscoped = packageName.split("/")[1];
        if (unscoped) {
            for (const filename of CHANGELOG_FILES) {
                paths.push(`packages/${unscoped}/${filename}`);
            }
        }
    }

    return paths;
}
