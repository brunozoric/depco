// Shared by ChangelogFileResolver (parses a fetched CHANGELOG.md/CHANGES.md
// file) and NpmReadmeResolver (parses a package README's changelog section).
// Splits markdown content into sections keyed by version heading (e.g.
// "## 1.2.3" or "## [1.2.3]") and returns only the sections matching the
// requested version set.
const VERSION_HEADING = /^#{1,2}\s+\[?v?(\d+\.\d+\.\d+[^\]]*)\]?/im;

export function parseVersionSections(content: string, versions: Set<string>): Map<string, string> {
    const lines = content.split("\n");
    const found = new Map<string, string>();
    let currentVersion: string | null = null;
    let currentLines: string[] = [];

    for (const line of lines) {
        const match = line.match(VERSION_HEADING);
        if (match) {
            if (currentVersion && versions.has(currentVersion)) {
                found.set(currentVersion, currentLines.join("\n").trim());
            }
            currentVersion = match[1]!;
            currentLines = [];
        } else if (currentVersion) {
            currentLines.push(line);
        }
    }

    if (currentVersion && versions.has(currentVersion)) {
        found.set(currentVersion, currentLines.join("\n").trim());
    }

    return found;
}
