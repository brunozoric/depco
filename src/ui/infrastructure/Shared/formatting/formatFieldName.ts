const ACRONYMS = new Set(["npm", "pnpm", "yarn"]);

/**
 * Turns a camelCase check key (e.g. "npmPreapprovedPackages") into a
 * human-readable label (e.g. "NPM Preapproved Packages"), upper-casing
 * known package-manager acronyms along the way.
 */
export function formatFieldName(key: string): string {
    const words = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ");

    return words
        .filter(word => word.length > 0)
        .map(word => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) {
                return lower.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ");
}
