# Backup Import — Dependencies + Changelogs (Part 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the import handler by adding dependency, version, and changelog import with proper ID resolution.

**Architecture:** For each dependency in the backup: insert/lookup by name to get ID, insert each version with resolved dependencyId, insert changelog with resolved dependencyVersionId. All use `onConflictDoNothing`.

**Tech Stack:** Fastify, Drizzle ORM, Zod, Vitest

## Global Constraints

- All inserts use `onConflictDoNothing` — never overwrite existing data
- Must resolve dependency and version IDs via query-back after insert
- Changelog import requires both dependencyId and dependencyVersionId

---

### Task 1: Dependencies + versions + changelogs import

**Files:**

- Modify: `src/api/routes/backup.ts` (add dependencies import section)
- Modify: `src/api/routes/__tests__/backup.test.ts` (add dependency import tests)

**Interfaces:**

- Consumes: `dependencies`, `dependencyVersions`, `changelogs` schemas from `#api/db/schema.js`
- Produces: Completed import handler

- [ ] **Step 1: Write failing test — import dependencies with versions**

Add to the `POST /api/projects/backup` describe block in `backup.test.ts`:

```typescript
it("imports dependencies with versions", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      dependencies: [
        {
          name: "react",
          repoUrl: "https://github.com/facebook/react",
          versions: [
            { version: "19.0.0", publishedAt: 2000 },
            { version: "18.0.0", publishedAt: 1000 }
          ]
        }
      ]
    })
  });

  const body = response.json();
  expect(body.dependencies.imported).toBe(3);
  expect(body.dependencies.skipped).toBe(0);

  const deps = await db.select().from(dependencies).all();
  expect(deps).toHaveLength(1);
  expect(deps[0]!.name).toBe("react");

  const versions = await db.select().from(dependencyVersions).all();
  expect(versions).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`
Expected: FAIL — dependencies import returns `{ imported: 0, skipped: 0 }`

- [ ] **Step 3: Implement dependencies + versions import**

Add to the import handler in `backup.ts`, before `reply.send(result)`:

```typescript
// Dependencies
for (const dep of backup.dependencies) {
  const depInserted =
    (
      await db
        .insert(dependencies)
        .values({
          id: generateId(),
          name: dep.name,
          repoUrl: dep.repoUrl,
          createdAt: Date.now()
        })
        .onConflictDoNothing()
        .run()
    ).changes > 0;

  const depRow = await db.select().from(dependencies).where(eq(dependencies.name, dep.name)).get();

  if (!depRow) {
    continue;
  }

  if (depInserted) {
    result.dependencies.imported++;
  } else {
    result.dependencies.skipped++;
  }

  for (const version of dep.versions) {
    const vInserted = await db
      .insert(dependencyVersions)
      .values({
        id: generateId(),
        dependencyId: depRow.id,
        version: version.version,
        publishedAt: version.publishedAt
      })
      .onConflictDoNothing()
      .run();

    if (vInserted.changes > 0) {
      result.dependencies.imported++;
    } else {
      result.dependencies.skipped++;
    }
  }
}
```

Note: The imported count includes 1 for the dependency row + 1 per version inserted. Skipped counts versions that already exist.

- [ ] **Step 4: Run test — should pass**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Write test — import dependencies with changelogs**

```typescript
it("imports dependencies with changelogs", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      dependencies: [
        {
          name: "react",
          repoUrl: null,
          versions: [
            {
              version: "19.0.0",
              publishedAt: 2000,
              changelog: { content: "Breaking changes", source: "github" }
            },
            {
              version: "18.0.0",
              publishedAt: 1000
            }
          ]
        }
      ]
    })
  });

  const body = response.json();
  expect(body.dependencies.imported).toBe(4);

  const cls = await db.select().from(changelogs).all();
  expect(cls).toHaveLength(1);
  expect(cls[0]!.content).toBe("Breaking changes");
  expect(cls[0]!.source).toBe("github");
});
```

- [ ] **Step 6: Implement changelog import**

Add inside the version loop in the import handler, after the version insert:

```typescript
if (version.changelog) {
  const versionRow = await db
    .select()
    .from(dependencyVersions)
    .where(
      eq(
        dependencyVersions.id,
        vInserted.changes > 0
          ? (
              await db
                .select()
                .from(dependencyVersions)
                .where(eq(dependencyVersions.dependencyId, depRow.id))
                .all()
            ).find(v => v.version === version.version)!.id
          : ""
      )
    )
    .get();

  // Simpler approach — just query back the version row
  const resolvedVersion = await db
    .select()
    .from(dependencyVersions)
    .where(eq(dependencyVersions.dependencyId, depRow.id))
    .all()
    .then(rows => rows.find(v => v.version === version.version));

  if (resolvedVersion) {
    const clInserted = await db
      .insert(changelogs)
      .values({
        id: generateId(),
        dependencyId: depRow.id,
        dependencyVersionId: resolvedVersion.id,
        content: version.changelog.content,
        source: version.changelog.source,
        fetchedAt: Date.now()
      })
      .onConflictDoNothing()
      .run();

    if (clInserted.changes > 0) {
      result.dependencies.imported++;
    } else {
      result.dependencies.skipped++;
    }
  }
}
```

**Important:** The above snippet has redundant code. Clean implementation — replace the entire version loop body with:

```typescript
for (const version of dep.versions) {
  const vInserted = await db
    .insert(dependencyVersions)
    .values({
      id: generateId(),
      dependencyId: depRow.id,
      version: version.version,
      publishedAt: version.publishedAt
    })
    .onConflictDoNothing()
    .run();

  if (vInserted.changes > 0) {
    result.dependencies.imported++;
  } else {
    result.dependencies.skipped++;
  }

  if (version.changelog) {
    const versionRow = (
      await db
        .select()
        .from(dependencyVersions)
        .where(eq(dependencyVersions.dependencyId, depRow.id))
        .all()
    ).find(v => v.version === version.version);

    if (versionRow) {
      const clInserted = await db
        .insert(changelogs)
        .values({
          id: generateId(),
          dependencyId: depRow.id,
          dependencyVersionId: versionRow.id,
          content: version.changelog.content,
          source: version.changelog.source,
          fetchedAt: Date.now()
        })
        .onConflictDoNothing()
        .run();

      if (clInserted.changes > 0) {
        result.dependencies.imported++;
      } else {
        result.dependencies.skipped++;
      }
    }
  }
}
```

- [ ] **Step 7: Run test — should pass**

Run: `npx vitest --config testing/vitest.config.ts --run src/api/routes/__tests__/backup.test.ts`

- [ ] **Step 8: Write test — skips existing dependencies and versions**

```typescript
it("skips existing dependencies and versions on re-import", async () => {
  const backup = makeBackup({
    dependencies: [
      {
        name: "react",
        repoUrl: null,
        versions: [{ version: "19.0.0", publishedAt: 2000 }]
      }
    ]
  });

  await app.inject({ method: "POST", url: "/api/projects/backup", payload: backup });
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: backup
  });

  const body = response.json();
  expect(body.dependencies.imported).toBe(0);
  expect(body.dependencies.skipped).toBe(2); // 1 dep + 1 version
});

it("imports changelog with null content", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: makeBackup({
      dependencies: [
        {
          name: "react",
          repoUrl: null,
          versions: [
            {
              version: "19.0.0",
              publishedAt: 2000,
              changelog: { content: null, source: null }
            }
          ]
        }
      ]
    })
  });

  const body = response.json();
  expect(body.dependencies.imported).toBe(3);

  const cls = await db.select().from(changelogs).all();
  expect(cls).toHaveLength(1);
  expect(cls[0]!.content).toBeNull();
  expect(cls[0]!.source).toBeNull();
});
```

- [ ] **Step 9: Run all tests**

Run: `npx vitest --config testing/vitest.config.ts --run`
Expected: All pass

- [ ] **Step 10: Write roundtrip test — export then import on fresh DB**

```typescript
it("roundtrip: export from populated DB, import into empty DB", async () => {
  await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();
  await db
    .insert(dependencies)
    .values({
      id: "d1",
      name: "react",
      repoUrl: null,
      createdAt: 1000
    })
    .run();
  await db
    .insert(dependencyVersions)
    .values({
      id: "v1",
      dependencyId: "d1",
      version: "19.0.0",
      publishedAt: 2000
    })
    .run();
  await db
    .insert(changelogs)
    .values({
      id: "cl1",
      dependencyId: "d1",
      dependencyVersionId: "v1",
      content: "changes",
      source: "github",
      fetchedAt: 3000
    })
    .run();

  const exportResponse = await app.inject({ method: "GET", url: "/api/projects/backup" });
  const backup = exportResponse.json();

  // Wipe all data
  await db.delete(changelogs).run();
  await db.delete(dependencyVersions).run();
  await db.delete(dependencies).run();
  await db.delete(appSettings).run();

  const importResponse = await app.inject({
    method: "POST",
    url: "/api/projects/backup",
    payload: backup
  });

  const body = importResponse.json();
  expect(body.appSettings.imported).toBe(1);
  expect(body.dependencies.imported).toBe(3);

  const cls = await db.select().from(changelogs).all();
  expect(cls).toHaveLength(1);
  expect(cls[0]!.content).toBe("changes");
});
```

- [ ] **Step 11: Run all tests**

Run: `npx vitest --config testing/vitest.config.ts --run`
Expected: All pass

- [ ] **Step 12: Commit**

```bash
git add src/api/routes/backup.ts src/api/routes/__tests__/backup.test.ts
git commit -m "feat: add backup import for dependencies, versions, and changelogs"
```
