// Numeric (major.minor.patch[...]) comparison used to order changelog entries
// received live over WebSocket alongside entries already returned by the API.
// Mirrors src/api/services/ChangelogService.ts#compareVersions — kept local to
// avoid importing API code into the UI layer.
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
