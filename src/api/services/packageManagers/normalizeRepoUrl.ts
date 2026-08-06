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
    const sshMatch = url.match(/^git@github\.com:([^/]+\/[^/]+)$/);
    if (sshMatch) {
        return `https://github.com/${sshMatch[1]}`;
    }
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== "github.com") {
            return null;
        }
        const pathMatch = parsed.pathname.match(/^\/([^/]+\/[^/]+)/);
        return pathMatch ? `https://github.com${pathMatch[0]}` : null;
    } catch {
        return null;
    }
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
