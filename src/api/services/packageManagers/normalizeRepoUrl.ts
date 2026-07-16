export function normalizeRepoUrl(repository: unknown): string | null {
    let url: string | undefined;
    if (typeof repository === "string") {
        url = repository;
    } else if (repository != null && typeof repository === "object") {
        url = (repository as { url?: string }).url;
    }
    if (!url) {
        return null;
    }
    url = url
        .replace(/^git\+/, "")
        .replace(/\.git$/, "")
        .replace(/^ssh:\/\/git@github\.com/, "https://github.com");
    if (!url.includes("github.com")) {
        return null;
    }
    const match = url.match(/github\.com[/:]([^/]+\/[^/]+)/);
    return match ? `https://github.com/${match[1]}` : null;
}

export function extractRepoDirectory(repository: unknown): string | null {
    if (repository != null && typeof repository === "object") {
        const dir = (repository as { directory?: string }).directory;
        if (typeof dir === "string" && dir.length > 0) {
            return dir;
        }
    }
    return null;
}
