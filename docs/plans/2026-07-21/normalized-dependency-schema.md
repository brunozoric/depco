# Normalized Dependency Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single `changelogs` table with three normalized tables (`dependencies`, `dependencyVersions`, `changelogs`) for a proper global package registry.

**Architecture:** Schema change + migration, then update the two consumers (ScanJobExecutor writes, ChangelogService reads/writes). External API contract unchanged — no UI changes needed.

**Tech Stack:** Drizzle ORM, SQLite, drizzle-kit for migration generation.

## Global Constraints

- External API contract unchanged — no UI changes
- Resolver chain unchanged — still receives `packageName`, `repoUrl`, `versions[]`
- Old changelogs table dropped entirely (no data migration — zero users)
- Same `content = null` / empty string semantics
- `generateId()` from `@webiny/stdlib` for all new row IDs
- Upsert patterns: Drizzle `onConflictDoUpdate` / `onConflictDoNothing`
- Code style: oxfmt 4-space indent, oxlint

---

### Task 1: Schema + Migration + Test DB

**Files:**

- Modify: `src/api/db/schema.ts` — replace `changelogs` table, add `dependencies` + `dependencyVersions`
- Create: migration via `drizzle-kit generate`
- Modify: `src/testing/helpers/createTestDb.ts` — replace changelogs SQL, add new tables

**Interfaces:**

- Produces: `dependencies`, `dependencyVersions`, `changelogs` Drizzle table exports. Used by Tasks 2 and 3.

- [ ] **Step 1: Replace changelogs and add new tables in schema.ts**

Replace the `changelogs` table definition in `src/api/db/schema.ts` with:

```typescript
export const dependencies = sqliteTable("dependencies", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull().unique(),
  repoUrl: text("repo_url"),
  createdAt: integer("created_at").notNull()
});

export const dependencyVersions = sqliteTable(
  "dependency_versions",
  {
    id: text("id").primaryKey().notNull(),
    dependencyId: text("dependency_id")
      .notNull()
      .references(() => dependencies.id),
    version: text("version").notNull(),
    publishedAt: integer("published_at")
  },
  table => ({
    depVersionUnique: uniqueIndex("dep_versions_dep_version_unique").on(
      table.dependencyId,
      table.version
    )
  })
);

export const changelogs = sqliteTable("changelogs", {
  id: text("id").primaryKey().notNull(),
  dependencyId: text("dependency_id")
    .notNull()
    .references(() => dependencies.id),
  dependencyVersionId: text("dependency_version_id")
    .notNull()
    .unique()
    .references(() => dependencyVersions.id),
  content: text("content"),
  source: text("source"),
  fetchedAt: integer("fetched_at")
});
```

- [ ] **Step 2: Generate migration**

```bash
yarn drizzle-kit generate --name normalized_dependencies
```

This creates the migration SQL and snapshot. Verify the generated SQL drops old `changelogs` and creates all three new tables.

- [ ] **Step 3: Update createTestDb.ts**

In `src/testing/helpers/createTestDb.ts`, replace the `changelogs` CREATE TABLE with:

```sql
CREATE TABLE dependencies (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    repo_url TEXT,
    created_at INTEGER NOT NULL
);
CREATE TABLE dependency_versions (
    id TEXT PRIMARY KEY NOT NULL,
    dependency_id TEXT NOT NULL REFERENCES dependencies(id),
    version TEXT NOT NULL,
    published_at INTEGER
);
CREATE UNIQUE INDEX dep_versions_dep_version_unique ON dependency_versions (dependency_id, version);
CREATE TABLE changelogs (
    id TEXT PRIMARY KEY NOT NULL,
    dependency_id TEXT NOT NULL REFERENCES dependencies(id),
    dependency_version_id TEXT NOT NULL UNIQUE REFERENCES dependency_versions(id),
    content TEXT,
    source TEXT,
    fetched_at INTEGER
);
```

- [ ] **Step 4: Build to verify schema compiles**

```bash
yarn build
```

Expected: build errors in `ScanJobExecutor.ts` and `ChangelogService.ts` (they reference old `changelogs.packageName`, `changelogs.version`, `changelogs.repoUrl` columns which no longer exist). These are fixed in Tasks 2 and 3.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: normalized dependency schema — dependencies, dependencyVersions, changelogs"
```

---

### Task 2: ScanJobExecutor — Upsert into Normalized Tables

**Files:**

- Modify: `src/api/services/jobExecutors/ScanJobExecutor.ts` — rewrite `insertChangelogPlaceholders`
- Modify: `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts` — update tests

**Interfaces:**

- Consumes: `dependencies`, `dependencyVersions`, `changelogs` tables from Task 1
- Produces: populated rows in all three tables during scan

- [ ] **Step 1: Rewrite insertChangelogPlaceholders**

In `src/api/services/jobExecutors/ScanJobExecutor.ts`, update imports to use new tables:

```typescript
import {
  projects,
  scanResults,
  upgradeJobs,
  pmSecuritySettings,
  dependencies,
  dependencyVersions,
  changelogs
} from "#api/db/schema.js";
```

Replace `insertChangelogPlaceholders` method:

```typescript
private async insertChangelogPlaceholders(
    scanDependencies: ScanService.Dependency[],
    registryData: Map<string, ScanService.RegistryData>,
    minimalAgeSeconds?: number
): Promise<void> {
    const ageCutoff =
        minimalAgeSeconds !== undefined ? Date.now() - minimalAgeSeconds * 1000 : undefined;

    for (const dep of scanDependencies) {
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

        // Upsert dependency row
        await this.databaseClient.db
            .insert(dependencies)
            .values({
                id: generateId(),
                name: dep.name,
                repoUrl: data.repoUrl,
                createdAt: Date.now()
            })
            .onConflictDoUpdate({
                target: dependencies.name,
                set: { repoUrl: data.repoUrl }
            })
            .run();

        const depRow = await this.databaseClient.db
            .select({ id: dependencies.id })
            .from(dependencies)
            .where(eq(dependencies.name, dep.name))
            .get();

        if (!depRow) {
            continue;
        }

        const dependencyId = depRow.id;

        // Upsert version rows + insert changelog placeholders
        for (const version of upgradeableVersions) {
            const publishedAt = data.time[version]
                ? new Date(data.time[version]!).getTime()
                : null;

            await this.databaseClient.db
                .insert(dependencyVersions)
                .values({
                    id: generateId(),
                    dependencyId,
                    version,
                    publishedAt
                })
                .onConflictDoNothing()
                .run();

            const versionRow = await this.databaseClient.db
                .select({ id: dependencyVersions.id })
                .from(dependencyVersions)
                .where(
                    and(
                        eq(dependencyVersions.dependencyId, dependencyId),
                        eq(dependencyVersions.version, version)
                    )
                )
                .get();

            if (!versionRow) {
                continue;
            }

            const existingChangelog = await this.databaseClient.db
                .select({ id: changelogs.id })
                .from(changelogs)
                .where(eq(changelogs.dependencyVersionId, versionRow.id))
                .get();

            if (!existingChangelog) {
                await this.databaseClient.db
                    .insert(changelogs)
                    .values({
                        id: generateId(),
                        dependencyId,
                        dependencyVersionId: versionRow.id
                    })
                    .run();
            }
        }
    }
}
```

- [ ] **Step 2: Update ScanJobExecutor tests**

In `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts`, update the test that verifies changelog placeholder insertion. After executor runs, verify:

- `dependencies` table has a row with the package name
- `dependencyVersions` table has rows for each upgradeable version
- `changelogs` table has rows with `content = null` and correct `dependencyId` + `dependencyVersionId`

Replace old assertions that checked `changelogs.packageName` / `changelogs.version` with queries against the new tables.

- [ ] **Step 3: Build + test**

```bash
yarn build && yarn test
```

Expected: `ChangelogService.test.ts` and `changelogs.test.ts` (route) still fail — they reference old columns. Fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: ScanJobExecutor upserts into normalized dependency tables"
```

---

### Task 3: ChangelogService — Query Normalized Tables

**Files:**

- Modify: `src/api/services/ChangelogService.ts` — update `resolve()` and `getChangelogs()`
- Modify: `src/api/services/__tests__/ChangelogService.test.ts` — update test setup and assertions

**Interfaces:**

- Consumes: `dependencies`, `dependencyVersions`, `changelogs` tables from Task 1
- Produces: same `IChangelogEntry` output (external API unchanged)

- [ ] **Step 1: Update ChangelogService imports and resolve()**

In `src/api/services/ChangelogService.ts`, update imports:

```typescript
import { and, eq, isNull } from "drizzle-orm";
import { changelogs, dependencies, dependencyVersions } from "#api/db/schema.js";
```

Rewrite `resolve()`:

```typescript
public async resolve(packageName: string): Promise<void> {
    const depRow = await this.databaseClient.db
        .select()
        .from(dependencies)
        .where(eq(dependencies.name, packageName))
        .get();

    if (!depRow) {
        return;
    }

    const unfetched = await this.databaseClient.db
        .select({
            id: changelogs.id,
            version: dependencyVersions.version
        })
        .from(changelogs)
        .innerJoin(
            dependencyVersions,
            eq(changelogs.dependencyVersionId, dependencyVersions.id)
        )
        .where(and(eq(changelogs.dependencyId, depRow.id), isNull(changelogs.content)))
        .all();

    if (unfetched.length === 0) {
        return;
    }

    const versions = unfetched.map(row => row.version);

    let found = new Map<string, string>();
    let winnerName: string | null = null;

    for (const resolver of this.resolvers) {
        found = await resolver.resolve(packageName, depRow.repoUrl, versions);
        if (found.size > 0) {
            winnerName = resolver.name;
            break;
        }
    }

    const fetchedAt = Date.now();
    for (const row of unfetched) {
        const content = found.get(row.version);
        await this.databaseClient.db
            .update(changelogs)
            .set({
                content: content ?? "",
                source: content !== undefined ? winnerName : "none",
                fetchedAt
            })
            .where(and(eq(changelogs.id, row.id), isNull(changelogs.content)))
            .run();
    }
}
```

- [ ] **Step 2: Update getChangelogs()**

```typescript
public async getChangelogs(
    packageName: string,
    from: string,
    to: string
): Promise<Abstraction.Entry[]> {
    const depRow = await this.databaseClient.db
        .select()
        .from(dependencies)
        .where(eq(dependencies.name, packageName))
        .get();

    if (!depRow) {
        return [];
    }

    const rows = await this.databaseClient.db
        .select({
            version: dependencyVersions.version,
            content: changelogs.content,
            source: changelogs.source
        })
        .from(changelogs)
        .innerJoin(
            dependencyVersions,
            eq(changelogs.dependencyVersionId, dependencyVersions.id)
        )
        .where(eq(changelogs.dependencyId, depRow.id))
        .all();

    return rows
        .filter(
            row =>
                compareVersions(row.version, from) > 0 &&
                compareVersions(row.version, to) <= 0
        )
        .sort((a, b) => compareVersions(a.version, b.version))
        .map(row => ({
            version: row.version,
            content: row.content,
            source: row.source
        }));
}
```

- [ ] **Step 3: Update ChangelogService tests**

In `src/api/services/__tests__/ChangelogService.test.ts`, test setup must now insert into `dependencies` + `dependencyVersions` + `changelogs` instead of just `changelogs`. For each test that creates changelog fixtures:

```typescript
// Old: insert into changelogs with packageName + version
// New:
const depId = generateId();
await db
  .insert(dependencies)
  .values({
    id: depId,
    name: "react",
    repoUrl: "https://github.com/facebook/react",
    createdAt: Date.now()
  })
  .run();

const versionId = generateId();
await db
  .insert(dependencyVersions)
  .values({
    id: versionId,
    dependencyId: depId,
    version: "19.0.0",
    publishedAt: null
  })
  .run();

await db
  .insert(changelogs)
  .values({
    id: generateId(),
    dependencyId: depId,
    dependencyVersionId: versionId,
    content: null, // or "some content" for fetched rows
    source: null,
    fetchedAt: null
  })
  .run();
```

Update all assertions that referenced `changelogs.packageName` or `changelogs.version`.

- [ ] **Step 4: Update changelogs route test**

In `src/api/routes/__tests__/changelogs.test.ts`, update test setup to insert into normalized tables (same pattern as Step 3). The route response shape is unchanged — tests should still assert `{ items: [{ version, content, source }], total }`.

- [ ] **Step 5: Build + test + lint**

```bash
yarn build && yarn test && yarn lint && yarn format:check
```

All 562 tests (or close — counts may shift with test changes) should pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor: ChangelogService queries normalized dependency tables"
```

---
