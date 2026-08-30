/**
 * Numeric (major.minor.patch[...]) comparison.
 * Non-numeric trailing parts (prerelease tags, etc.) are ignored —
 * sufficient for ordering versions drawn from a package's registry list.
 */
export function compareVersions(a: string, b: string): number {
    const toParts = (version: string): number[] =>
        version.split(".").map(part => parseInt(part, 10) || 0);

    const aParts = toParts(a);
    const bParts = toParts(b);
    const length = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < length; i++) {
        const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }

    return 0;
}
