// Shared by GitHubReleasesResolver and ChangelogFileResolver. `repoUrl` values
// stored in the `changelogs` table are already normalized (see
// packageManagers/normalizeRepoUrl.ts) to `https://github.com/<owner>/<repo>`,
// but the `[/:]` separator is matched defensively in case a raw URL (e.g.
// `git@github.com:owner/repo`) ever reaches this function.
export function extractOwnerRepo(repoUrl: string): string | null {
    const match = repoUrl.match(/github\.com[/:]([^/]+\/[^/]+)/);
    return match?.[1]?.replace(/\.git$/, "") ?? null;
}
