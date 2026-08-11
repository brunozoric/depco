export function parseEnginesNode(enginesField: string): number | null {
    if (!enginesField || enginesField === "*") {
        return null;
    }

    const versionPattern = /(?:>=?|<=?|[~^])?(\d+)(?:\.\d+)*/g;
    const matches: number[] = [];

    let match: RegExpExecArray | null;
    while ((match = versionPattern.exec(enginesField)) !== null) {
        const major = parseInt(match[1]!, 10);
        if (!isNaN(major)) {
            matches.push(major);
        }
    }

    if (matches.length === 0) {
        return null;
    }

    return Math.min(...matches);
}
