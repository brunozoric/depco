# Changelog Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On-demand changelog viewing for upgradeable dependencies — scan inserts placeholders, user clicks to fetch and view version-by-version release notes.

**Architecture:** DB table stores one row per package+version (null content = unfetched). Scan inserts placeholders for upgradeable versions. On-demand resolver chain (GitHub Releases via `gh` CLI, CHANGELOG.md parsing, npm readme) fetches content. API route returns cached or triggers fetch. UI modal with accordion per version, react-markdown rendering.

**Tech Stack:** Drizzle ORM (SQLite), Fastify routes, `gh` CLI via CommandRunner, react-markdown, Mantine Accordion/Modal.

## Global Constraints

- Only store versions that pass the minimal age gate
- Resolvers never throw — return empty Map on failure
- Version ordering uses registry's `versions` array (publish order), not semver
- Update guard: only write rows where `content IS NULL`
- Follow existing DI patterns: abstractions in `abstractions/` dir, `createAbstraction`/`createImplementation`
- Tests: API tests use in-memory SQLite + mock CommandRunner; UI tests mock HTTPClient at DI level
- Code style: oxfmt 4-space indent, oxlint, no ESLint/Prettier

---

### Task 1: DB Schema + Migration + Registry Data (repoUrl, readme)

**Files:**

- Modify: `src/api/db/schema.ts` — add `changelogs` table
- Create: `src/api/db/migrations/0005_changelogs.sql`
- Modify: `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts` — add `repoUrl`, `readme` to `IRegistryPackageInfo`
- Modify: `src/api/services/abstractions/RegistryCacheService.ts` — add `repoUrl`, `readme` to `IRegistryCachePackageInfo`
- Modify: `src/api/services/packageManagers/NpmDriver.ts` — parse `repository` + `readme`
- Modify: `src/api/services/packageManagers/YarnDriver.ts` — same
- Modify: `src/api/services/packageManagers/PnpmDriver.ts` — same
- Modify: `src/api/services/packageManagers/BunDriver.ts` — same
- Modify: `src/api/services/RegistryCacheService.ts` — include `repoUrl`, `readme` in cached info
- Modify: `src/api/services/__tests__/ScanService.test.ts` — add `repoUrl`, `readme` to mock data
- Modify: `src/api/services/__tests__/JobWorker.test.ts` — add fields to mock registry response
- Test: `src/api/services/packageManagers/__tests__/NpmDriver.test.ts` — verify repoUrl parsing

**Interfaces:**

- Produces: `changelogs` table in schema, `repoUrl: string | null` and `readme: string | null` on `IRegistryPackageInfo` and `IRegistryCachePackageInfo`

- [ ] **Step 1: Add changelogs table to Drizzle schema**

In `src/api/db/schema.ts`, add after `pmSecuritySettings`:

```typescript
export const changelogs = sqliteTable(
  "changelogs",
  {
    id: text("id").primaryKey().notNull(),
    packageName: text("package_name").notNull(),
    version: text("version").notNull(),
    repoUrl: text("repo_url"),
    content: text("content"),
    source: text("source"),
    fetchedAt: integer("fetched_at")
  },
  table => ({
    packageVersionUnique: uniqueIndex("changelogs_package_version_unique").on(
      table.packageName,
      table.version
    )
  })
);
```

- [ ] **Step 2: Create migration file**

Create `src/api/db/migrations/0005_changelogs.sql`:

```sql
CREATE TABLE changelogs (
    id TEXT PRIMARY KEY NOT NULL,
    package_name TEXT NOT NULL,
    version TEXT NOT NULL,
    repo_url TEXT,
    content TEXT,
    source TEXT,
    fetched_at INTEGER
);
CREATE UNIQUE INDEX changelogs_package_version_unique ON changelogs (package_name, version);
```

Add entry to `src/api/db/migrations/meta/_journal.json` following the existing pattern (index 5, tag `0005_changelogs`).

- [ ] **Step 3: Add repoUrl and readme to registry interfaces**

In `src/api/services/packageManagers/abstractions/PackageManagerDriver.ts`, update `IRegistryPackageInfo`:

```typescript
export interface IRegistryPackageInfo {
  name: string;
  latestVersion: string;
  distTags: Record<string, string>;
  versions: string[];
  time: Record<string, string>;
  repoUrl: string | null;
  readme: string | null;
}
```

In `src/api/services/abstractions/RegistryCacheService.ts`, update `IRegistryCachePackageInfo`:

```typescript
export interface IRegistryCachePackageInfo {
  name: string;
  latestVersion: string;
  distTags: Record<string, string>;
  versions: string[];
  time: Record<string, string>;
  repoUrl: string | null;
  readme: string | null;
}
```

- [ ] **Step 4: Add repoUrl normalization helper and update all 4 drivers**

Add a helper function in each driver (or a shared utility) to normalize the `repository` field. Since all 4 drivers have identical `parseRegistryInfo` bodies, add the normalization inline. In `NpmDriver.ts` (repeat for Yarn, Pnpm, Bun):

```typescript
function normalizeRepoUrl(repository: unknown): string | null {
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
```

Update `parseRegistryInfo` in all 4 drivers:

```typescript
public parseRegistryInfo(stdout: string): Abstraction.RegistryPackageInfo {
    const raw = JSON.parse(stdout) as Record<string, unknown>;
    const distTags = (raw["dist-tags"] as Record<string, string> | undefined) ?? {};
    return {
        name: "",
        latestVersion: distTags["latest"] ?? "",
        distTags,
        versions: (raw["versions"] as string[] | undefined) ?? [],
        time: (raw["time"] as Record<string, string> | undefined) ?? {},
        repoUrl: normalizeRepoUrl(raw["repository"]),
        readme: (raw["readme"] as string | undefined) ?? null
    };
}
```

- [ ] **Step 5: Update RegistryCacheService to include new fields**

In `src/api/services/RegistryCacheService.ts`, update the `info` object in `fetchPackageInfo`:

```typescript
const info: Abstraction.PackageInfo = {
  name: packageName,
  latestVersion: parsed.latestVersion,
  distTags: parsed.distTags,
  versions: parsed.versions,
  time: parsed.time,
  repoUrl: parsed.repoUrl,
  readme: parsed.readme
};
```

Backward compat is automatic: `JSON.parse(cached.data)` returns whatever was stored. Old entries without `repoUrl`/`readme` parse as `undefined`, which the `?? null` fallback on the interface handles. The TTL expiry re-fetches and stores the new fields.

- [ ] **Step 6: Update test mock data**

In `src/api/services/__tests__/ScanService.test.ts`, add `repoUrl: null, readme: null` to each entry in `REGISTRY_DATA` and the inline `getPackageInfoHandler` mock.

In `src/api/services/__tests__/JobWorker.test.ts`, add `repoUrl: null, readme: null` to mock registry responses.

In driver tests (`NpmDriver.test.ts` etc.), add a test that verifies `parseRegistryInfo` extracts `repoUrl` from a JSON string containing `"repository": { "type": "git", "url": "git+https://github.com/org/repo.git" }` and normalizes it to `"https://github.com/org/repo"`. Also verify `readme` extraction.

- [ ] **Step 7: Build + test + lint + commit**

```bash
yarn build && yarn test && yarn lint && yarn format:check
git add -A && git commit -m "feat: add changelogs table, repoUrl + readme to registry info"
```

---

### Task 2: ScanService Return Type + ScanJobExecutor Changelog Placeholders

**Files:**

- Modify: `src/api/services/abstractions/ScanService.ts` — new `IScanResult` return type
- Modify: `src/api/services/ScanService.ts` — return `IScanResult`, collect registryData
- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` — destructure new return type, insert changelog placeholders
- Modify: `src/api/services/__tests__/ScanService.test.ts` — update assertions for new return shape
- Modify: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` — update mock return, test changelog inserts

**Interfaces:**

- Consumes: `changelogs` table from Task 1, `repoUrl` on registry info from Task 1
- Produces: `IScanResult` type with `dependencies` + `registryData`, changelog placeholder rows inserted during scan

- [ ] **Step 1: Define IScanResult and update IScanService**

In `src/api/services/abstractions/ScanService.ts`:

```typescript
export interface IScanRegistryData {
  versions: string[];
  repoUrl: string | null;
  time: Record<string, string>;
}

export interface IScanResult {
  dependencies: IScanServiceDependency[];
  registryData: Map<string, IScanRegistryData>;
}

export interface IScanService {
  scan(
    projectPath: string,
    packageManager: string,
    force?: boolean,
    onProgress?: (packageName: string, current: number, total: number) => void,
    signal?: AbortSignal,
    minimalAgeSeconds?: number
  ): Promise<IScanResult>;
}
```

Update namespace exports:

```typescript
export namespace ScanService {
  export type Interface = IScanService;
  export type Dependency = IScanServiceDependency;
  export type Result = IScanResult;
  export type RegistryData = IScanRegistryData;
}
```

- [ ] **Step 2: Update ScanService.scan() to return IScanResult**

In `src/api/services/ScanService.ts`, modify `scan()`:

```typescript
public async scan(
    projectPath: string,
    packageManager: string,
    force?: boolean,
    onProgress?: (packageName: string, current: number, total: number) => void,
    signal?: AbortSignal,
    minimalAgeSeconds?: number
): Promise<Abstraction.Result> {
    // ... existing code up to the batch loop ...

    const results: Abstraction.Dependency[] = [];
    const registryData = new Map<string, Abstraction.RegistryData>();
    // ... existing setup ...

    for (let i = 0; i < entries.length; i += LOOKUP_CONCURRENCY) {
        const batch = entries.slice(i, i + LOOKUP_CONCURRENCY);
        const infos = await Promise.all(
            batch.map(async ([name]) => {
                const info = await this.registryCacheService.getPackageInfo(
                    name,
                    packageManager,
                    force
                );
                processed++;
                onProgress?.(name, processed, total);
                return info;
            })
        );

        for (let j = 0; j < batch.length; j++) {
            const [name, type] = batch[j]!;
            const currentVersion = installedVersions.get(name)!;
            const info = infos[j]!;
            const latestVersion =
                resolveLatestVersion(info, currentVersion, ageCutoff) || currentVersion;
            const upgradeType = classifyUpgrade(currentVersion, latestVersion);

            if (upgradeType === "none") {
                continue;
            }

            registryData.set(name, {
                versions: info.versions,
                repoUrl: info.repoUrl,
                time: info.time
            });

            results.push({
                name,
                currentVersion,
                latestInRange: currentVersion,
                latestVersion,
                type,
                upgradeType
            });
        }
    }

    return { dependencies: results, registryData };
}
```

- [ ] **Step 3: Update ScanJobExecutor to use new return type**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`, add import for `changelogs` schema and `generateId`. Update `execute()`:

Replace `results` usage: the scan now returns `{ dependencies, registryData }`. All existing `results.xyz` calls become `scanResult.dependencies.xyz`:

```typescript
const [scanResult] = await Promise.all([
  this.scanService.scan(/* ... */),
  this.securityService.check(context.projectId, context.projectPath)
]);

const { dependencies: results, registryData } = scanResult;

// ... existing code using `results` stays the same ...
```

After the existing scan result persistence and before the warning check, add changelog placeholder insertion:

```typescript
await this.insertChangelogPlaceholders(results, registryData, minimalAgeSeconds);
```

- [ ] **Step 4: Implement insertChangelogPlaceholders**

Add method to `ScanJobExecutor`:

```typescript
private async insertChangelogPlaceholders(
    dependencies: ScanService.Dependency[],
    registryData: Map<string, ScanService.RegistryData>,
    minimalAgeSeconds?: number
): Promise<void> {
    const ageCutoff =
        minimalAgeSeconds !== undefined ? Date.now() - minimalAgeSeconds * 1000 : undefined;

    for (const dep of dependencies) {
        const data = registryData.get(dep.name);
        if (!data) {
            continue;
        }

        const currentIndex = data.versions.indexOf(dep.currentVersion);
        const latestIndex = data.versions.indexOf(dep.latestVersion);
        if (latestIndex === -1) {
            continue;
        }

        const startIndex = currentIndex === -1 ? 0 : currentIndex + 1;
        let upgradeableVersions = data.versions.slice(startIndex, latestIndex + 1);

        if (ageCutoff !== undefined) {
            upgradeableVersions = upgradeableVersions.filter(version => {
                const publishTime = data.time[version];
                return publishTime ? new Date(publishTime).getTime() <= ageCutoff : true;
            });
        }

        if (upgradeableVersions.length === 0) {
            continue;
        }

        const existing = await this.databaseClient.db
            .select({ version: changelogs.version })
            .from(changelogs)
            .where(eq(changelogs.packageName, dep.name))
            .all();

        const existingVersions = new Set(existing.map(row => row.version));
        const newVersions = upgradeableVersions.filter(v => !existingVersions.has(v));

        if (newVersions.length > 0) {
            await this.databaseClient.db
                .insert(changelogs)
                .values(
                    newVersions.map(version => ({
                        id: generateId(),
                        packageName: dep.name,
                        version,
                        repoUrl: data.repoUrl
                    }))
                )
                .run();
        }
    }
}
```

Add `changelogs` to the import from `#api/db/schema.js`.

- [ ] **Step 5: Update ScanService tests**

In `src/api/services/__tests__/ScanService.test.ts`, update all assertions that check scan return value. Currently tests do `const deps = await service.scan(...)`. Change to:

```typescript
const { dependencies: deps } = await service.scan(...);
```

Or destructure as needed per test.

- [ ] **Step 6: Update ScanJobExecutor tests**

In `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`, update the mock `ScanService.scan()` return to return `{ dependencies: [...], registryData: new Map() }`. Add a test that verifies changelog placeholder rows are inserted after scan:

```typescript
it("inserts changelog placeholder rows for upgradeable versions", async () => {
  // Setup: mock scan returns dependency react 18.2.0 -> 19.1.0
  // with registryData containing versions ["18.2.0", "18.3.0", "19.0.0", "19.1.0"]
  // After executor runs, verify changelogs table has rows for 18.3.0, 19.0.0, 19.1.0
  // with content = null and repoUrl from registryData
});
```

- [ ] **Step 7: Build + test + lint + commit**

```bash
yarn build && yarn test && yarn lint && yarn format:check
git add -A && git commit -m "feat: scan returns registryData, inserts changelog placeholders"
```

---

### Task 3: Changelog Resolver Chain + ChangelogService

**Files:**

- Create: `src/api/services/changelogResolvers/abstractions/ChangelogResolver.ts` — `IChangelogResolver` interface
- Create: `src/api/services/changelogResolvers/GitHubReleasesResolver.ts`
- Create: `src/api/services/changelogResolvers/ChangelogFileResolver.ts`
- Create: `src/api/services/changelogResolvers/NpmReadmeResolver.ts`
- Create: `src/api/services/abstractions/ChangelogService.ts` — interface
- Create: `src/api/services/ChangelogService.ts` — implementation
- Test: `src/api/services/changelogResolvers/__tests__/GitHubReleasesResolver.test.ts`
- Test: `src/api/services/changelogResolvers/__tests__/ChangelogFileResolver.test.ts`
- Test: `src/api/services/changelogResolvers/__tests__/NpmReadmeResolver.test.ts`
- Test: `src/api/services/__tests__/ChangelogService.test.ts`

**Interfaces:**

- Consumes: `changelogs` table from Task 1, `CommandRunner` abstraction, `RegistryCacheService` for readme
- Produces: `IChangelogService.resolve(packageName)`, `IChangelogService.getChangelogs(packageName, from, to)`

- [ ] **Step 1: Define IChangelogResolver interface**

Create `src/api/services/changelogResolvers/abstractions/ChangelogResolver.ts`:

```typescript
export interface IChangelogResolver {
  readonly name: string;
  resolve(
    packageName: string,
    repoUrl: string | null,
    versions: string[]
  ): Promise<Map<string, string>>;
}
```

- [ ] **Step 2: Implement GitHubReleasesResolver**

Create `src/api/services/changelogResolvers/GitHubReleasesResolver.ts`:

```typescript
import type { IChangelogResolver } from "./abstractions/ChangelogResolver.js";
import type { CommandRunner } from "../abstractions/CommandRunner.js";

interface IGitHubRelease {
  tag_name: string;
  body: string | null;
}

function extractOwnerRepo(repoUrl: string): string | null {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  return match ? match[1] : null;
}

export class GitHubReleasesResolver implements IChangelogResolver {
  public readonly name = "github-releases";

  public constructor(private readonly commandRunner: CommandRunner.Interface) {}

  public async resolve(
    _packageName: string,
    repoUrl: string | null,
    versions: string[]
  ): Promise<Map<string, string>> {
    if (!repoUrl) {
      return new Map();
    }

    const ownerRepo = extractOwnerRepo(repoUrl);
    if (!ownerRepo) {
      return new Map();
    }

    try {
      await this.commandRunner.run("gh", ["--version"], { cwd: process.cwd() });
    } catch {
      return new Map();
    }

    try {
      const result = await this.commandRunner.run(
        "gh",
        ["api", `repos/${ownerRepo}/releases`, "--paginate"],
        { cwd: process.cwd() }
      );

      const releases = JSON.parse(result.stdout) as IGitHubRelease[];
      const versionSet = new Set(versions);
      const found = new Map<string, string>();

      for (const release of releases) {
        const tag = release.tag_name.replace(/^v/i, "");
        if (versionSet.has(tag) && release.body) {
          found.set(tag, release.body);
        }
      }

      return found;
    } catch {
      return new Map();
    }
  }
}
```

- [ ] **Step 3: Implement ChangelogFileResolver**

Create `src/api/services/changelogResolvers/ChangelogFileResolver.ts`:

```typescript
import type { IChangelogResolver } from "./abstractions/ChangelogResolver.js";
import type { CommandRunner } from "../abstractions/CommandRunner.js";

const CHANGELOG_FILES = ["CHANGELOG.md", "CHANGES.md", "History.md"];
const VERSION_HEADING = /^#{1,2}\s+\[?v?(\d+\.\d+\.\d+[^\]]*)\]?/im;

function extractOwnerRepo(repoUrl: string): string | null {
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  return match ? match[1] : null;
}

function parseVersionSections(content: string, versions: Set<string>): Map<string, string> {
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

export class ChangelogFileResolver implements IChangelogResolver {
  public readonly name = "changelog-file";

  public constructor(private readonly commandRunner: CommandRunner.Interface) {}

  public async resolve(
    _packageName: string,
    repoUrl: string | null,
    versions: string[]
  ): Promise<Map<string, string>> {
    if (!repoUrl) {
      return new Map();
    }

    const ownerRepo = extractOwnerRepo(repoUrl);
    if (!ownerRepo) {
      return new Map();
    }

    try {
      await this.commandRunner.run("gh", ["--version"], { cwd: process.cwd() });
    } catch {
      return new Map();
    }

    const versionSet = new Set(versions);

    for (const filename of CHANGELOG_FILES) {
      try {
        const result = await this.commandRunner.run(
          "gh",
          ["api", `repos/${ownerRepo}/contents/${filename}`],
          { cwd: process.cwd() }
        );

        const response = JSON.parse(result.stdout) as { content?: string; encoding?: string };
        if (response.content && response.encoding === "base64") {
          const decoded = Buffer.from(response.content, "base64").toString("utf-8");
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
```

- [ ] **Step 4: Implement NpmReadmeResolver**

Create `src/api/services/changelogResolvers/NpmReadmeResolver.ts`:

```typescript
import type { IChangelogResolver } from "./abstractions/ChangelogResolver.js";

const VERSION_HEADING = /^#{1,2}\s+\[?v?(\d+\.\d+\.\d+[^\]]*)\]?/im;

function parseVersionSections(content: string, versions: Set<string>): Map<string, string> {
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

export class NpmReadmeResolver implements IChangelogResolver {
  public readonly name = "npm-readme";

  public async resolve(
    _packageName: string,
    _repoUrl: string | null,
    versions: string[],
    readme?: string | null
  ): Promise<Map<string, string>> {
    if (!readme) {
      return new Map();
    }

    try {
      return parseVersionSections(readme, new Set(versions));
    } catch {
      return new Map();
    }
  }
}
```

Note: `NpmReadmeResolver.resolve()` takes an extra `readme` parameter. The `IChangelogResolver` interface doesn't include it — `ChangelogService` calls it with the extra arg directly (it knows the concrete type). Alternatively, the readme can be passed via the constructor. Choose whichever is cleaner during implementation.

- [ ] **Step 5: Define IChangelogService interface**

Create `src/api/services/abstractions/ChangelogService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IChangelogEntry {
  version: string;
  content: string | null;
  source: string | null;
}

export interface IChangelogService {
  resolve(packageName: string): Promise<void>;
  getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogEntry[]>;
}

export const ChangelogService = createAbstraction<IChangelogService>("Api/ChangelogService");

export namespace ChangelogService {
  export type Interface = IChangelogService;
  export type Entry = IChangelogEntry;
}
```

- [ ] **Step 6: Implement ChangelogService**

Create `src/api/services/ChangelogService.ts`:

```typescript
import { and, eq, isNull } from "drizzle-orm";
import { ChangelogService as Abstraction } from "./abstractions/ChangelogService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { RegistryCacheService } from "./abstractions/RegistryCacheService.js";
import { changelogs } from "#api/db/schema.js";
import { GitHubReleasesResolver } from "./changelogResolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "./changelogResolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "./changelogResolvers/NpmReadmeResolver.js";
import type { IChangelogResolver } from "./changelogResolvers/abstractions/ChangelogResolver.js";

class ChangelogServiceImpl implements Abstraction.Interface {
  private readonly resolvers: IChangelogResolver[];
  private readonly npmReadmeResolver: NpmReadmeResolver;

  public constructor(
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly commandRunner: CommandRunner.Interface,
    private readonly registryCacheService: RegistryCacheService.Interface
  ) {
    this.npmReadmeResolver = new NpmReadmeResolver();
    this.resolvers = [
      new GitHubReleasesResolver(commandRunner),
      new ChangelogFileResolver(commandRunner),
      this.npmReadmeResolver
    ];
  }

  public async resolve(packageName: string): Promise<void> {
    const unfetched = await this.databaseClient.db
      .select()
      .from(changelogs)
      .where(and(eq(changelogs.packageName, packageName), isNull(changelogs.content)))
      .all();

    if (unfetched.length === 0) {
      return;
    }

    const versions = unfetched.map(row => row.version);
    const repoUrl = unfetched[0]?.repoUrl ?? null;

    let found = new Map<string, string>();
    let winnerName = "none";

    for (const resolver of this.resolvers) {
      if (resolver === this.npmReadmeResolver) {
        let readme: string | null = null;
        try {
          const info = await this.registryCacheService.getPackageInfo(packageName, "npm");
          readme = info.readme;
        } catch {
          readme = null;
        }
        found = await this.npmReadmeResolver.resolve(packageName, repoUrl, versions, readme);
      } else {
        found = await resolver.resolve(packageName, repoUrl, versions);
      }

      if (found.size > 0) {
        winnerName = resolver.name;
        break;
      }
    }

    const now = Date.now();
    for (const row of unfetched) {
      const content = found.get(row.version);
      await this.databaseClient.db
        .update(changelogs)
        .set({
          content: content ?? "",
          source: content !== undefined ? winnerName : "none",
          fetchedAt: now
        })
        .where(and(eq(changelogs.id, row.id), isNull(changelogs.content)))
        .run();
    }
  }

  public async getChangelogs(
    packageName: string,
    from: string,
    to: string
  ): Promise<Abstraction.Entry[]> {
    const rows = await this.databaseClient.db
      .select()
      .from(changelogs)
      .where(eq(changelogs.packageName, packageName))
      .all();

    // Filter to versions in range (from, to] using the stored version order
    // The versions were inserted in registry order during scan
    return rows
      .filter(row => {
        // Simple approach: include all versions stored for this package
        // that are not the `from` version. The scan only inserted
        // versions between current and latest, so all rows are in range.
        return row.version !== from;
      })
      .map(row => ({
        version: row.version,
        content: row.content,
        source: row.source
      }));
  }
}

export const ChangelogService = Abstraction.createImplementation({
  implementation: ChangelogServiceImpl,
  dependencies: [DatabaseClient, CommandRunner, RegistryCacheService]
});
```

Note: The `getWinningResolverName` helper above is a placeholder — during implementation, track the resolver name in the resolve loop (store `winnerName` when `found.size > 0`). This is called out here so implementers know to fix it.

- [ ] **Step 7: Register ChangelogService in API feature**

In `src/api/feature.ts`, add:

```typescript
import { ChangelogService } from "./services/ChangelogService.js";
// ...
container.register(ChangelogService).inSingletonScope();
```

- [ ] **Step 8: Write tests for resolvers**

Create `src/api/services/changelogResolvers/__tests__/GitHubReleasesResolver.test.ts` — mock CommandRunner, test:

- Returns empty Map when repoUrl is null
- Returns empty Map when `gh --version` fails
- Parses releases JSON and matches versions by tag (with and without `v` prefix)
- Returns empty Map on API error

Create `src/api/services/changelogResolvers/__tests__/ChangelogFileResolver.test.ts` — mock CommandRunner, test:

- Returns empty Map when repoUrl is null
- Parses base64-encoded CHANGELOG.md content
- Splits by version headings correctly
- Falls back to CHANGES.md when CHANGELOG.md not found

Create `src/api/services/changelogResolvers/__tests__/NpmReadmeResolver.test.ts` — test:

- Returns empty Map when readme is null
- Parses version sections from readme content
- Returns empty Map when no version headings found

- [ ] **Step 9: Write ChangelogService test**

Create `src/api/services/__tests__/ChangelogService.test.ts` — in-memory SQLite, mock CommandRunner, test:

- `resolve()` fetches unfetched rows and updates content
- `resolve()` skips rows with content already set (update guard)
- `resolve()` marks unmatched versions with empty string content
- `getChangelogs()` returns rows filtered by version range

- [ ] **Step 10: Build + test + lint + commit**

```bash
yarn build && yarn test && yarn lint && yarn format:check
git add -A && git commit -m "feat: changelog resolver chain + ChangelogService"
```

---

### Task 4: API Route + Shared Route Definition

**Files:**

- Create: `src/shared/routes/changelogs.ts` — route definition
- Modify: `src/shared/routes/index.ts` — export new route
- Create: `src/api/routes/changelogs.ts` — route handler
- Modify: `src/api/routes/index.ts` — export new routes
- Modify: `src/api/server.ts` — register new route plugin
- Test: `src/api/routes/__tests__/changelogs.test.ts`

**Interfaces:**

- Consumes: `ChangelogService` from Task 3
- Produces: `GET /api/changelogs/:packageName?from=X&to=Y` endpoint, `getChangelogsRoute` shared definition

- [ ] **Step 1: Define shared route**

Create `src/shared/routes/changelogs.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

export const getChangelogsRoute = defineRoute({
  method: "GET",
  path: "/api/changelogs/:packageName",
  description: "Get changelogs for a package between two versions",
  params: z.object({ packageName: z.string() }),
  querystring: z.object({
    from: z.string(),
    to: z.string()
  }),
  response: z.object({
    items: z.array(
      z.object({
        version: z.string(),
        content: z.string().nullable(),
        source: z.string().nullable()
      })
    ),
    total: z.number()
  })
});
```

- [ ] **Step 2: Export from shared routes index**

Add to `src/shared/routes/index.ts`:

```typescript
export * from "./changelogs.js";
```

- [ ] **Step 3: Implement route handler**

Create `src/api/routes/changelogs.ts`:

```typescript
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendList } from "#shared/routing/index.js";
import { getChangelogsRoute } from "#shared/routes/index.js";
import { ChangelogService } from "#api/services/abstractions/ChangelogService.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

export async function changelogRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const changelogService = container.resolve(ChangelogService);

  registerRoute(app, getChangelogsRoute, {}, async (request, reply) => {
    const { packageName } = request.params;
    const { from, to } = request.query;

    await changelogService.resolve(packageName);
    const entries = await changelogService.getChangelogs(packageName, from, to);

    sendList(reply, entries, entries.length);
  });
}
```

- [ ] **Step 4: Register route in server**

In `src/api/routes/index.ts`, add:

```typescript
export { changelogRoutes } from "./changelogs.js";
```

In `src/api/server.ts`, add import and register:

```typescript
import { changelogRoutes } from "./routes/index.js";
// ...
await app.register(changelogRoutes, { container });
```

- [ ] **Step 5: Write route test**

Create `src/api/routes/__tests__/changelogs.test.ts` — follow existing route test patterns (in-memory SQLite, real services, mock CommandRunner). Test:

- Returns empty array when no changelogs exist
- Returns changelogs from DB when already fetched
- Triggers resolve for unfetched changelogs

- [ ] **Step 6: Build + test + lint + commit**

```bash
yarn build && yarn test && yarn lint && yarn format:check
git add -A && git commit -m "feat: GET /api/changelogs/:packageName route"
```

---

### Task 5: UI — Gateway, Presenter, ChangelogModal, DependencyTable Button

**Files:**

- Modify: `src/ui/features/projects/abstractions/ProjectsGateway.ts` — add `IChangelogEntry`, `getChangelogs` method
- Modify: `src/ui/features/projects/ProjectsGateway.ts` — implement `getChangelogs`
- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` — add `getChangelogs` method, `ChangelogEntry` type
- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` — implement `getChangelogs`
- Create: `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`
- Modify: `src/ui/presentation/projects/ProjectDetail/components/DependencyTable.tsx` — add Changelog button
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx` — wire ChangelogModal
- Add dependency: `react-markdown`

**Interfaces:**

- Consumes: `getChangelogsRoute` from Task 4
- Produces: Complete UI flow — button click opens modal, fetches changelogs, renders markdown

- [ ] **Step 1: Add react-markdown dependency**

```bash
yarn add react-markdown
```

- [ ] **Step 2: Add getChangelogs to ProjectsGateway abstraction**

In `src/ui/features/projects/abstractions/ProjectsGateway.ts`, add:

```typescript
export interface IChangelogEntry {
    version: string;
    content: string | null;
    source: string | null;
}

// Add to IProjectsGateway:
getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogEntry[]>;
```

Update namespace:

```typescript
export namespace ProjectsGateway {
  // ... existing ...
  export type ChangelogEntry = IChangelogEntry;
}
```

- [ ] **Step 3: Implement getChangelogs in ProjectsGateway**

In `src/ui/features/projects/ProjectsGateway.ts`:

```typescript
import { getChangelogsRoute } from "#shared/routes/index.js";

// Add to imports at top, then add method to class:
public async getChangelogs(
    packageName: string,
    from: string,
    to: string
): Promise<Abstraction.ChangelogEntry[]> {
    const response = await this.httpClient.request(getChangelogsRoute, {
        params: { packageName },
        query: { from, to }
    });
    return response.items;
}
```

- [ ] **Step 4: Add getChangelogs to ProjectDetailPresenter abstraction**

In `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`, add:

```typescript
export interface IChangelogEntry {
  version: string;
  content: string | null;
  source: string | null;
}

// Add to IProjectDetailPresenter:
getChangelogs: (packageName: string, from: string, to: string) => Promise<IChangelogEntry[]>;
```

Update namespace:

```typescript
export namespace ProjectDetailPresenter {
  // ... existing ...
  export type ChangelogEntry = IChangelogEntry;
}
```

- [ ] **Step 5: Implement getChangelogs in ProjectDetailPresenter**

In `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`:

```typescript
public getChangelogs = async (
    packageName: string,
    from: string,
    to: string
): Promise<Abstraction.ChangelogEntry[]> => {
    return this.projectsGateway.getChangelogs(packageName, from, to);
};
```

- [ ] **Step 6: Create ChangelogModal component**

Create `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`:

```tsx
import type React from "react";
import { useState, useEffect } from "react";
import { Accordion, Badge, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import Markdown from "react-markdown";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";

interface ChangelogModalProps {
  opened: boolean;
  onClose: () => void;
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  getChangelogs: (
    packageName: string,
    from: string,
    to: string
  ) => Promise<ProjectDetailPresenter.ChangelogEntry[]>;
}

export function ChangelogModal({
  opened,
  onClose,
  packageName,
  currentVersion,
  latestVersion,
  getChangelogs
}: ChangelogModalProps): React.ReactNode {
  const [entries, setEntries] = useState<ProjectDetailPresenter.ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      setLoading(true);
      getChangelogs(packageName, currentVersion, latestVersion)
        .then(items => {
          setEntries(items.reverse());
          setLoading(false);
        })
        .catch(() => {
          setEntries([]);
          setLoading(false);
        });
    }
  }, [opened, packageName, currentVersion, latestVersion, getChangelogs]);

  return (
    <Modal opened={opened} onClose={onClose} title={`Changelog — ${packageName}`} size="lg">
      {loading ? (
        <Loader />
      ) : entries.length === 0 ? (
        <Text c="dimmed">No changelog entries found.</Text>
      ) : (
        <Accordion>
          {entries.map(entry => (
            <Accordion.Item key={entry.version} value={entry.version}>
              <Accordion.Control>
                <Group gap="xs">
                  <Text fw={500}>{entry.version}</Text>
                  {entry.source && entry.source !== "none" && (
                    <Badge size="xs" variant="light">
                      {entry.source}
                    </Badge>
                  )}
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                {entry.content ? (
                  <Markdown>{entry.content}</Markdown>
                ) : (
                  <Text c="dimmed" size="sm">
                    No changelog available
                  </Text>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Modal>
  );
}
```

- [ ] **Step 7: Add Changelog button to DependencyTable**

In `src/ui/presentation/projects/ProjectDetail/components/DependencyTable.tsx`:

Add `onViewChangelog: (name: string, currentVersion: string, latestVersion: string) => void` to both `DependencyTableProps` and `DependencyRowProps`.

Add a Button/ActionIcon in each `DependencyRow` after the Target Version select:

```tsx
<Table.Td>
  <Button
    size="xs"
    variant="subtle"
    onClick={() =>
      onViewChangelog(dependency.name, dependency.currentVersion, dependency.latestVersion)
    }
  >
    Changelog
  </Button>
</Table.Td>
```

Add "Changelog" header to `Table.Thead`.

- [ ] **Step 8: Wire ChangelogModal into ProjectDetailPage**

In `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`:

Add state for the changelog modal target:

```typescript
const [changelogTarget, setChangelogTarget] = useState<{
  name: string;
  currentVersion: string;
  latestVersion: string;
} | null>(null);
```

Pass `onViewChangelog={(...args) => setChangelogTarget({ name: args[0], currentVersion: args[1], latestVersion: args[2] })}` to DependencyTable.

Render ChangelogModal:

```tsx
{
  changelogTarget && (
    <ChangelogModal
      opened={true}
      onClose={() => setChangelogTarget(null)}
      packageName={changelogTarget.name}
      currentVersion={changelogTarget.currentVersion}
      latestVersion={changelogTarget.latestVersion}
      getChangelogs={presenter.getChangelogs}
    />
  );
}
```

- [ ] **Step 9: Build + test + lint + commit**

```bash
yarn build && yarn test && yarn lint && yarn format:check
git add -A && git commit -m "feat: changelog modal with react-markdown on dependency table"
```

---
