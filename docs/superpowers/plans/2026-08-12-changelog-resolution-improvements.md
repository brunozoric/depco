# Changelog Resolution Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three HTTP-based changelog resolvers to improve changelog coverage for public/private repos, and fix the misleading changelog count on the packages page.

**Architecture:** Three new resolvers supplement the existing `gh` CLI chain: RawGitHubChangelogResolver (unauthenticated raw.githubusercontent.com for public repos), GitHubHttpReleasesResolver and GitHubHttpFileResolver (authenticated api.github.com with optional `github_token`). A shared `readGitHubToken` helper reads and decrypts the token from `app_settings`. The packages page changelog count changes from a single total to resolved/pending split across all data layers.

**Tech Stack:** TypeScript 7, Vitest, global `fetch()`, Zod, Drizzle ORM, Mantine UI

## Global Constraints

- Use `yarn full` to validate (adio + lint:fix + format:fix + build + test)
- Named interfaces only — no inline structural types
- Object params with named keys for 2+ params
- All JSON.parse validated with Zod
- Full words in identifiers — no abbreviations
- Resolvers never throw — return empty `Map` on any error
- Resolver `name` property must be a unique string identifier
- `createAbstraction`/`createImplementation`/`createFeature` pattern for DI

---

### Task 1: RawGitHubChangelogResolver

**Files:**
- Create: `src/api/services/Changelog/resolvers/RawGitHubChangelogResolver.ts`
- Create: `src/api/services/Changelog/__tests__/RawGitHubChangelogResolver.test.ts`

**Interfaces:**
- Consumes: `ChangelogResolver` abstraction (`src/api/services/Changelog/abstractions/ChangelogResolver.ts`), `extractOwnerRepo` (`src/api/services/Changelog/extractOwnerRepo.ts`), `parseVersionSections` (`src/api/services/Changelog/parseVersionSections.ts`)
- Produces: `RawGitHubChangelogResolver` — DI token registered as `ChangelogResolver` implementation. Class exported for DI registration in feature.ts (Task 5).

This resolver fetches CHANGELOG.md from `raw.githubusercontent.com` via global `fetch()`. No authentication, works for public repos only. No DI dependencies.

- [ ] **Step 1: Write the test file**

Create `src/api/services/Changelog/__tests__/RawGitHubChangelogResolver.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RawGitHubChangelogResolver } from "../resolvers/RawGitHubChangelogResolver.js";

const CHANGELOG_CONTENT = [
    "# Changelog",
    "",
    "## 3.0.0 - 2023-01-15",
    "",
    "### Breaking changes",
    "",
    "- Dropped support for Node 14",
    "",
    "## 2.0.0 - 2022-06-01",
    "",
    "- Added new feature"
].join("\n");

describe("RawGitHubChangelogResolver", () => {
    let resolver: InstanceType<typeof RawGitHubChangelogResolver>;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        resolver = new RawGitHubChangelogResolver();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("has the name 'raw-github-changelog'", () => {
        expect(resolver.name).toBe("raw-github-changelog");
    });

    it("returns empty map when repoUrl is null", async () => {
        const result = await resolver.resolve("some-pkg", null, ["3.0.0"]);
        expect(result.size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns empty map when repoUrl is not a GitHub URL", async () => {
        const result = await resolver.resolve(
            "some-pkg",
            "https://gitlab.com/owner/repo",
            ["3.0.0"]
        );
        expect(result.size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches CHANGELOG.md from main branch first", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => CHANGELOG_CONTENT
        });

        const result = await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(1);
        expect(result.get("3.0.0")).toContain("Dropped support for Node 14");
        expect(fetchMock).toHaveBeenCalledWith(
            "https://raw.githubusercontent.com/owner/repo/main/CHANGELOG.md"
        );
    });

    it("falls back to master branch when main returns 404", async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: false, status: 404 })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => CHANGELOG_CONTENT
            });

        const result = await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "https://raw.githubusercontent.com/owner/repo/master/CHANGELOG.md"
        );
    });

    it("tries repoDirectory path first when provided", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => CHANGELOG_CONTENT
        });

        await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"],
            "packages/core"
        );

        expect(fetchMock).toHaveBeenCalledWith(
            "https://raw.githubusercontent.com/owner/repo/main/packages/core/CHANGELOG.md"
        );
    });

    it("tries scoped package path for @scope/name packages", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("packages/my-lib/CHANGELOG.md") && url.includes("/main/")) {
                return { ok: true, text: async () => CHANGELOG_CONTENT };
            }
            return { ok: false, status: 404 };
        });

        const result = await resolver.resolve(
            "@scope/my-lib",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(1);
    });

    it("returns empty map when all paths return 404", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        const result = await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(0);
    });

    it("returns empty map when fetch throws", async () => {
        fetchMock.mockRejectedValue(new Error("network error"));

        const result = await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(0);
    });

    it("returns empty map when CHANGELOG.md has no matching versions", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            text: async () => "# Changelog\n\n## 99.0.0\n\nFuture release"
        });

        const result = await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(0);
    });

    it("tries CHANGES.md and History.md after CHANGELOG.md", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("CHANGES.md") && url.includes("/main/")) {
                return { ok: true, text: async () => CHANGELOG_CONTENT };
            }
            return { ok: false, status: 404 };
        });

        const result = await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(1);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/Changelog/__tests__/RawGitHubChangelogResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/api/services/Changelog/resolvers/RawGitHubChangelogResolver.ts`:

```typescript
import { ChangelogResolver as Abstraction } from "../abstractions/ChangelogResolver.js";
import { extractOwnerRepo } from "../extractOwnerRepo.js";
import { parseVersionSections } from "../parseVersionSections.js";

const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];
const BRANCHES = ["main", "master"];

interface IFetchChangelogInput {
    ownerRepo: string;
    path: string;
    versions: Set<string>;
}

async function fetchChangelog(
    input: IFetchChangelogInput
): Promise<Map<string, string>> {
    const { ownerRepo, path, versions } = input;

    for (const branch of BRANCHES) {
        try {
            const url = `https://raw.githubusercontent.com/${ownerRepo}/${branch}/${path}`;
            const response = await fetch(url);
            if (!response.ok) {
                continue;
            }
            const body = await response.text();
            const found = parseVersionSections(body, versions);
            if (found.size > 0) {
                return found;
            }
        } catch {
            continue;
        }
    }

    return new Map();
}

class RawGitHubChangelogResolverImpl implements Abstraction.Interface {
    public readonly name = "raw-github-changelog";

    public async resolve(
        packageName: string,
        repoUrl: string | null,
        versions: string[],
        repoDirectory?: string | null
    ): Promise<Map<string, string>> {
        if (!repoUrl) {
            return new Map();
        }

        const ownerRepo = extractOwnerRepo(repoUrl);
        if (!ownerRepo) {
            return new Map();
        }

        const versionSet = new Set(versions);
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

        for (const path of paths) {
            const found = await fetchChangelog({ ownerRepo, path, versions: versionSet });
            if (found.size > 0) {
                return found;
            }
        }

        return new Map();
    }
}

export const RawGitHubChangelogResolver = Abstraction.createImplementation({
    implementation: RawGitHubChangelogResolverImpl,
    dependencies: []
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/Changelog/__tests__/RawGitHubChangelogResolver.test.ts`
Expected: PASS — all 10 tests green

- [ ] **Step 5: Run full suite and commit**

Run: `yarn full`

```bash
git add src/api/services/Changelog/resolvers/RawGitHubChangelogResolver.ts src/api/services/Changelog/__tests__/RawGitHubChangelogResolver.test.ts
git commit -m "feat: add RawGitHubChangelogResolver for unauthenticated public repo changelogs"
```

---

### Task 2: Shared GitHub token helper

**Files:**
- Create: `src/api/services/Changelog/resolvers/readGitHubToken.ts`
- Create: `src/api/services/Changelog/__tests__/readGitHubToken.test.ts`

**Interfaces:**
- Consumes: `DatabaseClient` (`src/api/db/abstractions/DatabaseClient.ts`), `EncryptionService` (`src/api/services/Encryption/abstractions/EncryptionService.ts`), `appSettings` table (`src/api/db/schema.ts`)
- Produces: `readGitHubToken(input: IReadGitHubTokenInput): Promise<IGitHubTokenResult>` — used by Task 3 and Task 4

- [ ] **Step 1: Write the test file**

Create `src/api/services/Changelog/__tests__/readGitHubToken.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { registerEncryption } from "#testing/helpers/registerEncryption.js";
import { appSettings } from "#api/db/schema.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { readGitHubToken } from "../resolvers/readGitHubToken.js";

describe("readGitHubToken", () => {
    it("returns the decrypted token when github_token is configured", async () => {
        const { container, db } = createTestApiContainer();
        registerEncryption(container);
        const encryptionService = container.resolve(EncryptionService);
        const databaseClient = container.resolve(DatabaseClient);

        const encrypted = encryptionService.encrypt("ghp_test123");
        await db
            .insert(appSettings)
            .values({ key: "github_token", value: encrypted })
            .run();

        const result = await readGitHubToken({ databaseClient, encryptionService });

        expect(result.token).toBe("ghp_test123");
    });

    it("returns null when github_token is not configured", async () => {
        const { container } = createTestApiContainer();
        registerEncryption(container);
        const encryptionService = container.resolve(EncryptionService);
        const databaseClient = container.resolve(DatabaseClient);

        const result = await readGitHubToken({ databaseClient, encryptionService });

        expect(result.token).toBeNull();
    });

    it("returns null when github_token value is empty", async () => {
        const { container, db } = createTestApiContainer();
        registerEncryption(container);
        const encryptionService = container.resolve(EncryptionService);
        const databaseClient = container.resolve(DatabaseClient);

        await db
            .insert(appSettings)
            .values({ key: "github_token", value: "" })
            .run();

        const result = await readGitHubToken({ databaseClient, encryptionService });

        expect(result.token).toBeNull();
    });

    it("returns null when decryption fails", async () => {
        const { container, db } = createTestApiContainer();
        registerEncryption(container);
        const databaseClient = container.resolve(DatabaseClient);
        const failingEncryptionService: EncryptionService.Interface = {
            encrypt: () => "",
            decrypt: () => {
                throw new Error("decryption failed");
            }
        };

        await db
            .insert(appSettings)
            .values({ key: "github_token", value: "invalid-cipher" })
            .run();

        const result = await readGitHubToken({
            databaseClient,
            encryptionService: failingEncryptionService
        });

        expect(result.token).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/Changelog/__tests__/readGitHubToken.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/api/services/Changelog/resolvers/readGitHubToken.ts`:

```typescript
import { eq } from "drizzle-orm";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { appSettings } from "#api/db/schema.js";

export interface IReadGitHubTokenInput {
    databaseClient: DatabaseClient.Interface;
    encryptionService: EncryptionService.Interface;
}

export interface IGitHubTokenResult {
    token: string | null;
}

export async function readGitHubToken(
    input: IReadGitHubTokenInput
): Promise<IGitHubTokenResult> {
    const { databaseClient, encryptionService } = input;

    const row = await databaseClient.db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "github_token"))
        .get();

    if (!row?.value) {
        return { token: null };
    }

    try {
        const token = encryptionService.decrypt(row.value);
        return { token };
    } catch {
        return { token: null };
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/Changelog/__tests__/readGitHubToken.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Run full suite and commit**

Run: `yarn full`

```bash
git add src/api/services/Changelog/resolvers/readGitHubToken.ts src/api/services/Changelog/__tests__/readGitHubToken.test.ts
git commit -m "feat: add readGitHubToken shared helper for HTTP changelog resolvers"
```

---

### Task 3: GitHubHttpReleasesResolver

**Files:**
- Create: `src/api/services/Changelog/resolvers/GitHubHttpReleasesResolver.ts`
- Create: `src/api/services/Changelog/__tests__/GitHubHttpReleasesResolver.test.ts`

**Interfaces:**
- Consumes: `ChangelogResolver` abstraction, `extractOwnerRepo`, `readGitHubToken` (from Task 2), `DatabaseClient`, `EncryptionService`
- Produces: `GitHubHttpReleasesResolver` — DI token registered as `ChangelogResolver` implementation. Class exported for DI registration in feature.ts (Task 5).

- [ ] **Step 1: Write the test file**

Create `src/api/services/Changelog/__tests__/GitHubHttpReleasesResolver.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubHttpReleasesResolver } from "../resolvers/GitHubHttpReleasesResolver.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";

function createMockDeps(): {
    databaseClient: DatabaseClient.Interface;
    encryptionService: EncryptionService.Interface;
} {
    return {
        databaseClient: {
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            get: async () => null
                        })
                    })
                })
            }
        } as unknown as DatabaseClient.Interface,
        encryptionService: {
            encrypt: (value: string) => value,
            decrypt: (value: string) => value
        }
    };
}

const RELEASES_JSON = JSON.stringify([
    { tag_name: "v3.0.0", body: "## Breaking changes\n\nDropped Node 14" },
    { tag_name: "v2.0.0", body: "## New features\n\nAdded widgets" },
    { tag_name: "v1.0.0", body: null }
]);

describe("GitHubHttpReleasesResolver", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("has the name 'github-http-releases'", () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        expect(resolver.name).toBe("github-http-releases");
    });

    it("returns empty map when repoUrl is null", async () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve("pkg", null, ["3.0.0"]);
        expect(result.size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches releases and matches versions by stripping v prefix", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => JSON.parse(RELEASES_JSON)
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );

        const result = await resolver.resolve(
            "some-pkg",
            "https://github.com/owner/repo",
            ["3.0.0", "2.0.0"]
        );

        expect(result.size).toBe(2);
        expect(result.get("3.0.0")).toContain("Dropped Node 14");
        expect(result.get("2.0.0")).toContain("Added widgets");
    });

    it("handles monorepo tags with packageName@version format", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => [
                { tag_name: "@scope/pkg@4.0.0", body: "Release 4.0" },
                { tag_name: "other-pkg@4.0.0", body: "Wrong package" }
            ]
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );

        const result = await resolver.resolve(
            "@scope/pkg",
            "https://github.com/owner/repo",
            ["4.0.0"]
        );

        expect(result.size).toBe(1);
        expect(result.get("4.0.0")).toBe("Release 4.0");
    });

    it("sends Authorization header when github_token is configured", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        const deps = createMockDeps();
        deps.databaseClient = {
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            get: async () => ({ key: "github_token", value: "encrypted" })
                        })
                    })
                })
            }
        } as unknown as DatabaseClient.Interface;
        deps.encryptionService.decrypt = () => "ghp_realtoken";

        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("api.github.com"),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer ghp_realtoken"
                })
            })
        );
    });

    it("works without auth header when no token configured", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        const callArgs = fetchMock.mock.calls[0];
        const headers = callArgs?.[1]?.headers ?? {};
        expect(headers).not.toHaveProperty("Authorization");
    });

    it("returns empty map on HTTP error", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["1.0.0"]
        );

        expect(result.size).toBe(0);
    });

    it("returns empty map on fetch error", async () => {
        fetchMock.mockRejectedValueOnce(new Error("network error"));

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["1.0.0"]
        );

        expect(result.size).toBe(0);
    });

    it("skips releases with null body", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => [{ tag_name: "v1.0.0", body: null }]
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["1.0.0"]
        );

        expect(result.size).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/Changelog/__tests__/GitHubHttpReleasesResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/api/services/Changelog/resolvers/GitHubHttpReleasesResolver.ts`:

```typescript
import { z } from "zod";
import { ChangelogResolver as Abstraction } from "../abstractions/ChangelogResolver.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { extractOwnerRepo } from "../extractOwnerRepo.js";
import { readGitHubToken } from "./readGitHubToken.js";

const githubReleasesSchema = z.array(
    z.object({
        tag_name: z.string(),
        body: z.string().nullable().default(null)
    })
);

class GitHubHttpReleasesResolverImpl implements Abstraction.Interface {
    public readonly name = "github-http-releases";

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly encryptionService: EncryptionService.Interface
    ) {}

    public async resolve(
        packageName: string,
        repoUrl: string | null,
        versions: string[],
        _repoDirectory?: string | null
    ): Promise<Map<string, string>> {
        if (!repoUrl) {
            return new Map();
        }

        const ownerRepo = extractOwnerRepo(repoUrl);
        if (!ownerRepo) {
            return new Map();
        }

        try {
            const { token } = await readGitHubToken({
                databaseClient: this.databaseClient,
                encryptionService: this.encryptionService
            });

            const headers: Record<string, string> = {
                Accept: "application/vnd.github+json"
            };
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch(
                `https://api.github.com/repos/${ownerRepo}/releases?per_page=100`,
                { headers }
            );

            if (!response.ok) {
                return new Map();
            }

            const releases = githubReleasesSchema.parse(await response.json());
            const versionSet = new Set(versions);
            const found = new Map<string, string>();

            for (const release of releases) {
                if (!release.body) {
                    continue;
                }

                const tag = release.tag_name;
                const stripped = tag.replace(/^v/i, "");
                if (versionSet.has(stripped)) {
                    found.set(stripped, release.body);
                    continue;
                }

                const lastAt = tag.lastIndexOf("@");
                if (lastAt > 0) {
                    const tagPackage = tag.substring(0, lastAt);
                    const tagVersion = tag.substring(lastAt + 1).replace(/^v/i, "");
                    if (tagPackage === packageName && versionSet.has(tagVersion)) {
                        found.set(tagVersion, release.body);
                    }
                }
            }

            return found;
        } catch {
            return new Map();
        }
    }
}

export const GitHubHttpReleasesResolver = Abstraction.createImplementation({
    implementation: GitHubHttpReleasesResolverImpl,
    dependencies: [DatabaseClient, EncryptionService]
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/Changelog/__tests__/GitHubHttpReleasesResolver.test.ts`
Expected: PASS — all 9 tests green

- [ ] **Step 5: Run full suite and commit**

Run: `yarn full`

```bash
git add src/api/services/Changelog/resolvers/GitHubHttpReleasesResolver.ts src/api/services/Changelog/__tests__/GitHubHttpReleasesResolver.test.ts
git commit -m "feat: add GitHubHttpReleasesResolver for HTTP-based GitHub release notes"
```

---

### Task 4: GitHubHttpFileResolver

**Files:**
- Create: `src/api/services/Changelog/resolvers/GitHubHttpFileResolver.ts`
- Create: `src/api/services/Changelog/__tests__/GitHubHttpFileResolver.test.ts`

**Interfaces:**
- Consumes: `ChangelogResolver` abstraction, `extractOwnerRepo`, `parseVersionSections`, `readGitHubToken` (Task 2), `DatabaseClient`, `EncryptionService`
- Produces: `GitHubHttpFileResolver` — DI token for feature.ts (Task 5)

- [ ] **Step 1: Write the test file**

Create `src/api/services/Changelog/__tests__/GitHubHttpFileResolver.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubHttpFileResolver } from "../resolvers/GitHubHttpFileResolver.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";

function createMockDeps(): {
    databaseClient: DatabaseClient.Interface;
    encryptionService: EncryptionService.Interface;
} {
    return {
        databaseClient: {
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            get: async () => null
                        })
                    })
                })
            }
        } as unknown as DatabaseClient.Interface,
        encryptionService: {
            encrypt: (value: string) => value,
            decrypt: (value: string) => value
        }
    };
}

const CHANGELOG_CONTENT = [
    "# Changelog",
    "",
    "## 3.0.0",
    "",
    "- Breaking change",
    "",
    "## 2.0.0",
    "",
    "- New feature"
].join("\n");

function toBase64(content: string): string {
    return Buffer.from(content, "utf-8").toString("base64");
}

describe("GitHubHttpFileResolver", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("has the name 'github-http-file'", () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        expect(resolver.name).toBe("github-http-file");
    });

    it("returns empty map when repoUrl is null", async () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve("pkg", null, ["3.0.0"]);
        expect(result.size).toBe(0);
    });

    it("fetches and decodes base64 CHANGELOG.md content", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: toBase64(CHANGELOG_CONTENT),
                encoding: "base64"
            })
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );

        const result = await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(1);
        expect(result.get("3.0.0")).toContain("Breaking change");
    });

    it("tries repoDirectory path first", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: toBase64(CHANGELOG_CONTENT),
                encoding: "base64"
            })
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );

        await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["3.0.0"],
            "packages/core"
        );

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("contents/packages/core/CHANGELOG.md"),
            expect.anything()
        );
    });

    it("falls through on 404 to next path", async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: false, status: 404 })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    content: toBase64(CHANGELOG_CONTENT),
                    encoding: "base64"
                })
            });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );

        const result = await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("sends Authorization header when token is configured", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        const deps = createMockDeps();
        deps.databaseClient = {
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            get: async () => ({ key: "github_token", value: "encrypted" })
                        })
                    })
                })
            }
        } as unknown as DatabaseClient.Interface;
        deps.encryptionService.decrypt = () => "ghp_token123";

        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(fetchMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer ghp_token123"
                })
            })
        );
    });

    it("returns empty map when all paths return 404", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(0);
    });

    it("returns empty map on fetch error", async () => {
        fetchMock.mockRejectedValue(new Error("network error"));

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve(
            "pkg",
            "https://github.com/owner/repo",
            ["3.0.0"]
        );

        expect(result.size).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/Changelog/__tests__/GitHubHttpFileResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/api/services/Changelog/resolvers/GitHubHttpFileResolver.ts`:

```typescript
import { z } from "zod";
import { ChangelogResolver as Abstraction } from "../abstractions/ChangelogResolver.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";
import { extractOwnerRepo } from "../extractOwnerRepo.js";
import { parseVersionSections } from "../parseVersionSections.js";
import { readGitHubToken } from "./readGitHubToken.js";

const githubContentsSchema = z.object({
    content: z.string().optional(),
    encoding: z.string().optional()
});

const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];

class GitHubHttpFileResolverImpl implements Abstraction.Interface {
    public readonly name = "github-http-file";

    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly encryptionService: EncryptionService.Interface
    ) {}

    public async resolve(
        packageName: string,
        repoUrl: string | null,
        versions: string[],
        repoDirectory?: string | null
    ): Promise<Map<string, string>> {
        if (!repoUrl) {
            return new Map();
        }

        const ownerRepo = extractOwnerRepo(repoUrl);
        if (!ownerRepo) {
            return new Map();
        }

        const { token } = await readGitHubToken({
            databaseClient: this.databaseClient,
            encryptionService: this.encryptionService
        });

        const headers: Record<string, string> = {
            Accept: "application/vnd.github+json"
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const versionSet = new Set(versions);
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

        for (const filePath of paths) {
            try {
                const response = await fetch(
                    `https://api.github.com/repos/${ownerRepo}/contents/${filePath}`,
                    { headers }
                );

                if (!response.ok) {
                    continue;
                }

                const data = githubContentsSchema.parse(await response.json());
                if (data.content && data.encoding === "base64") {
                    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
                    const found = parseVersionSections(decoded, versionSet);
                    if (found.size > 0) {
                        return found;
                    }
                }
            } catch {
                continue;
            }
        }

        return new Map();
    }
}

export const GitHubHttpFileResolver = Abstraction.createImplementation({
    implementation: GitHubHttpFileResolverImpl,
    dependencies: [DatabaseClient, EncryptionService]
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/Changelog/__tests__/GitHubHttpFileResolver.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Run full suite and commit**

Run: `yarn full`

```bash
git add src/api/services/Changelog/resolvers/GitHubHttpFileResolver.ts src/api/services/Changelog/__tests__/GitHubHttpFileResolver.test.ts
git commit -m "feat: add GitHubHttpFileResolver for authenticated CHANGELOG.md fetching"
```

---

### Task 5: DI registration and resolver chain ordering

**Files:**
- Modify: `src/api/services/Changelog/feature.ts`
- Modify: `src/api/services/Changelog/index.ts` (if it exists and needs new exports)

**Interfaces:**
- Consumes: All four resolver DI tokens: `RawGitHubChangelogResolver` (Task 1), `GitHubHttpReleasesResolver` (Task 3), `GitHubHttpFileResolver` (Task 4), plus existing `GitHubReleasesResolver`, `ChangelogFileResolver`, `NpmReadmeResolver`
- Produces: Updated `ChangelogFeature` with all 6 resolvers registered in correct order

The `{ multiple: true }` DI injection resolves in registration order — the first resolver registered is tried first in the chain. Registration order must match the spec's resolver chain: GitHubReleasesResolver (gh CLI) → ChangelogFileResolver (gh CLI) → RawGitHubChangelogResolver (fetch, no auth) → GitHubHttpReleasesResolver (fetch, token) → GitHubHttpFileResolver (fetch, token) → NpmReadmeResolver (registry).

- [ ] **Step 1: Update feature.ts**

Modify `src/api/services/Changelog/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { ChangelogService } from "./ChangelogService.js";
import { GitHubReleasesResolver } from "./resolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "./resolvers/ChangelogFileResolver.js";
import { RawGitHubChangelogResolver } from "./resolvers/RawGitHubChangelogResolver.js";
import { GitHubHttpReleasesResolver } from "./resolvers/GitHubHttpReleasesResolver.js";
import { GitHubHttpFileResolver } from "./resolvers/GitHubHttpFileResolver.js";
import { NpmReadmeResolver } from "./resolvers/NpmReadmeResolver.js";

export const ChangelogFeature = createFeature({
    name: "Api/ChangelogFeature",
    register(container) {
        container.register(GitHubReleasesResolver);
        container.register(ChangelogFileResolver);
        container.register(RawGitHubChangelogResolver);
        container.register(GitHubHttpReleasesResolver);
        container.register(GitHubHttpFileResolver);
        container.register(NpmReadmeResolver);
        container.register(ChangelogService).inSingletonScope();
    }
});
```

- [ ] **Step 2: Run full suite and commit**

Run: `yarn full`

```bash
git add src/api/services/Changelog/feature.ts
git commit -m "feat: register three new HTTP changelog resolvers in resolver chain"
```

---

### Task 6: Changelog count accuracy — full data layer

**Files:**
- Modify: `src/api/routes/packages.ts`
- Modify: `src/shared/routes/packages.ts`
- Modify: `src/ui/features/Packages/abstractions/PackagesGateway.ts`
- Modify: `src/ui/features/Packages/PackagesGateway.ts`
- Modify: `src/ui/presentation/Packages/PackageList/abstractions/PackagesPresenter.ts`
- Modify: `src/ui/presentation/Packages/PackageList/PackagesPresenter.ts`
- Modify: `src/ui/presentation/Packages/PackageList/components/columns/ChangelogButton.tsx`
- Modify: `src/ui/presentation/Packages/PackageList/__tests__/PackagesPresenter.test.ts`
- Modify: `src/ui/features/Packages/__tests__/PackagesGateway.test.ts` (if it exists)

**Interfaces:**
- Consumes: existing `changelogCount: number` field across all layers
- Produces: `resolvedChangelogCount: number` and `totalChangelogCount: number` across all layers

- [ ] **Step 1: Update the API route SQL**

In `src/api/routes/packages.ts`, replace the changelog subquery in both `countQuery` and `dataQuery`. Also update `IRawPackageRow` and `IPackageListItem` interfaces, the `havingClause`, and the row mapping.

Replace `IRawPackageRow`:
```typescript
interface IRawPackageRow {
    name: string;
    projects: string;
    resolvedChangelogCount: number;
    totalChangelogCount: number;
    lastPublishedAt: number | null;
    dependencyKind: string;
    registryResolved: number;
}
```

Replace `IPackageListItem`:
```typescript
interface IPackageListItem {
    name: string;
    projects: IPackageProject[];
    resolvedChangelogCount: number;
    totalChangelogCount: number;
    lastPublishedAt: number | null;
    dependencyKind: string;
    registryResolved: boolean;
}
```

Replace the `havingClause`:
```typescript
const havingClause = hasChangelog === "true" ? sql`HAVING totalChangelogCount > 0` : sql``;
```

Replace the changelog subquery in `countQuery` (lines 101-106):
```sql
LEFT JOIN (
    SELECT d.name AS dep_name,
        COUNT(*) AS total_cnt,
        COUNT(CASE WHEN c.content IS NOT NULL AND c.content != '' AND c.source != 'none' THEN 1 END) AS resolved_cnt
    FROM changelogs c
    JOIN dependencies d ON c.dependency_id = d.id
    GROUP BY d.name
) cl ON cl.dep_name = sr.name
```

In `countQuery`, replace `COALESCE(cl.cnt, 0) AS changelogCount` with `COALESCE(cl.total_cnt, 0) AS totalChangelogCount`.

Replace the same subquery in `dataQuery` (lines 131-136), and replace `COALESCE(cl.cnt, 0) AS changelogCount` with:
```sql
COALESCE(cl.resolved_cnt, 0) AS resolvedChangelogCount,
COALESCE(cl.total_cnt, 0) AS totalChangelogCount,
```

Replace the row mapping (line 160):
```typescript
const items: IPackageListItem[] = rawRows.map(row => ({
    name: row.name,
    projects: JSON.parse(row.projects) as IPackageProject[],
    resolvedChangelogCount: row.resolvedChangelogCount ?? 0,
    totalChangelogCount: row.totalChangelogCount ?? 0,
    lastPublishedAt: row.lastPublishedAt ?? null,
    dependencyKind: row.dependencyKind,
    registryResolved: row.registryResolved === 1
}));
```

- [ ] **Step 2: Update the shared route schema**

In `src/shared/routes/packages.ts`, replace `changelogCount: z.number()` in `packageListItemSchema` with:
```typescript
resolvedChangelogCount: z.number(),
totalChangelogCount: z.number(),
```

- [ ] **Step 3: Update the gateway abstraction**

In `src/ui/features/Packages/abstractions/PackagesGateway.ts`, replace `changelogCount: number` in `IPackageListItem` with:
```typescript
resolvedChangelogCount: number;
totalChangelogCount: number;
```

- [ ] **Step 4: Update the presenter abstraction and implementation**

In `src/ui/presentation/Packages/PackageList/abstractions/PackagesPresenter.ts`, replace `changelogCount: number` in `IPackageListItemViewModel` with:
```typescript
resolvedChangelogCount: number;
totalChangelogCount: number;
```

In `src/ui/presentation/Packages/PackageList/PackagesPresenter.ts`, replace `changelogCount: pkg.changelogCount` in the mapping (around line 103) with:
```typescript
resolvedChangelogCount: pkg.resolvedChangelogCount,
totalChangelogCount: pkg.totalChangelogCount,
```

- [ ] **Step 5: Update ChangelogButton display logic**

In `src/ui/presentation/Packages/PackageList/components/columns/ChangelogButton.tsx`:

```typescript
import type React from "react";
import { Button, Table, Text } from "@mantine/core";
import type { IPackageListItemViewModel } from "../../abstractions/PackagesPresenter.js";

interface ChangelogButtonProps {
    pkg: IPackageListItemViewModel;
    onOpenChangelog: (pkg: IPackageListItemViewModel) => void;
}

export function ChangelogButton({ pkg, onOpenChangelog }: ChangelogButtonProps): React.ReactNode {
    const resolved = pkg.resolvedChangelogCount;
    const pending = pkg.totalChangelogCount - resolved;
    const hasAny = pkg.totalChangelogCount > 0;

    return (
        <Table.Td>
            {pkg.highestUpgradeType !== "none" && hasAny && (
                <Button
                    size="xs"
                    variant="subtle"
                    onClick={event => {
                        event.stopPropagation();
                        onOpenChangelog(pkg);
                    }}
                >
                    Changelog
                    {resolved > 0 && pending > 0 && (
                        <>
                            {` (${resolved}`}
                            <Text component="span" size="xs" c="dimmed">
                                {`+${pending}`}
                            </Text>
                            {")"}
                        </>
                    )}
                    {resolved > 0 && pending === 0 && ` (${resolved})`}
                    {resolved === 0 && pending > 0 && (
                        <Text component="span" size="xs" c="dimmed">
                            {` (+${pending})`}
                        </Text>
                    )}
                </Button>
            )}
        </Table.Td>
    );
}
```

- [ ] **Step 6: Update the presenter test**

In `src/ui/presentation/Packages/PackageList/__tests__/PackagesPresenter.test.ts`, replace `changelogCount: 3` in the `packagesResult` fixture (around line 90) with:
```typescript
resolvedChangelogCount: 3,
totalChangelogCount: 5,
```

Update any assertions that reference `changelogCount` to use the new field names.

- [ ] **Step 7: Run full suite and commit**

Run: `yarn full`

```bash
git add src/api/routes/packages.ts src/shared/routes/packages.ts src/ui/features/Packages/abstractions/PackagesGateway.ts src/ui/features/Packages/PackagesGateway.ts src/ui/presentation/Packages/PackageList/abstractions/PackagesPresenter.ts src/ui/presentation/Packages/PackageList/PackagesPresenter.ts src/ui/presentation/Packages/PackageList/components/columns/ChangelogButton.tsx src/ui/presentation/Packages/PackageList/__tests__/PackagesPresenter.test.ts
git commit -m "feat: split changelog count into resolved/pending for accurate display"
```
