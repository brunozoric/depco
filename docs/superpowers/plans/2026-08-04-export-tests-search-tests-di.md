# Export Tests, Search Tests, DI Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration tests for vulnerability dependencyType server-side filter, unit tests for project list search, and document CustomStepResolver as intentionally non-DI.

**Architecture:** Task 1 adds API integration tests seeding scan_results + vulnerabilities to verify `filterByDependencyType` works end-to-end. Task 2 adds presenter unit tests for searchQuery filtering. Task 3 is a no-op — CustomStepResolver uses a factory pattern with runtime data and correctly stays as a plain class.

**Tech Stack:** TypeScript, Vitest, Fastify, SQLite (in-memory)

## Global Constraints

- Do NOT amend commits — always create new commits
- Named interfaces only — no inline structural types
- Work directly on main — no feature branches, no worktrees

---

### Task 1: Vulnerability dependencyType Server-Side Tests

**Files:**

- Modify: `src/api/routes/__tests__/vulnerabilities.test.ts`

**Interfaces:**

- Consumes: `createTestContext()` helper, `insertTestProject()`, `seedVulnerabilities()`, `scanResults` table, `vulnerabilities` table
- Produces: Test coverage for `filterByDependencyType` on list and export routes

- [ ] **Step 1: Add scanResults import and seed helper**

In `src/api/routes/__tests__/vulnerabilities.test.ts`, add `scanResults` to the schema import:

```typescript
import { projects, vulnerabilities, teams, teamProjects, scanResults } from "#api/db/schema.js";
```

Add a helper after the existing `seedVulnerabilitiesAcrossProjects` function:

```typescript
async function seedScanResult(db: TestDb, projectId: string, packageName: string): Promise<void> {
  await db
    .insert(scanResults)
    .values({
      id: generateId(),
      projectId,
      name: packageName,
      currentVersion: "1.0.0",
      latestVersion: "1.0.0",
      latestInRange: "1.0.0",
      type: "dependency",
      upgradeType: "none",
      scannedAt: Date.now()
    })
    .run();
}
```

- [ ] **Step 2: Add dependencyType test block**

Add a new `describe` block inside the main `describe("vulnerability routes")`:

```typescript
describe("dependencyType filtering", () => {
  it("list route returns only direct dependencies when dependencyType=direct", async () => {
    const { app, db } = await createTestContext();
    try {
      await insertTestProject(db, "proj-1");
      await seedScanResult(db, "proj-1", "lodash");

      await db
        .insert(vulnerabilities)
        .values([
          makeVulnerability({ projectId: "proj-1", packageName: "lodash", dedupKey: "d1" }),
          makeVulnerability({ projectId: "proj-1", packageName: "transitive-pkg", dedupKey: "d2" })
        ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/vulnerabilities?dependencyType=direct"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].packageName).toBe("lodash");
      expect(body.items[0].isTransitive).toBe(false);
    } finally {
      await app.close();
    }
  });

  it("list route returns only transitive dependencies when dependencyType=transitive", async () => {
    const { app, db } = await createTestContext();
    try {
      await insertTestProject(db, "proj-1");
      await seedScanResult(db, "proj-1", "lodash");

      await db
        .insert(vulnerabilities)
        .values([
          makeVulnerability({ projectId: "proj-1", packageName: "lodash", dedupKey: "d1" }),
          makeVulnerability({ projectId: "proj-1", packageName: "transitive-pkg", dedupKey: "d2" })
        ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/vulnerabilities?dependencyType=transitive"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].packageName).toBe("transitive-pkg");
      expect(body.items[0].isTransitive).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("list route returns all when no dependencyType specified", async () => {
    const { app, db } = await createTestContext();
    try {
      await insertTestProject(db, "proj-1");
      await seedScanResult(db, "proj-1", "lodash");

      await db
        .insert(vulnerabilities)
        .values([
          makeVulnerability({ projectId: "proj-1", packageName: "lodash", dedupKey: "d1" }),
          makeVulnerability({ projectId: "proj-1", packageName: "transitive-pkg", dedupKey: "d2" })
        ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/vulnerabilities"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
    } finally {
      await app.close();
    }
  });

  it("export route filters by dependencyType=direct", async () => {
    const { app, db } = await createTestContext();
    try {
      await insertTestProject(db, "proj-1");
      await seedScanResult(db, "proj-1", "lodash");

      await db
        .insert(vulnerabilities)
        .values([
          makeVulnerability({ projectId: "proj-1", packageName: "lodash", dedupKey: "d1" }),
          makeVulnerability({ projectId: "proj-1", packageName: "transitive-pkg", dedupKey: "d2" })
        ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/vulnerabilities/export?format=json&dependencyType=direct"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].packageName).toBe("lodash");
    } finally {
      await app.close();
    }
  });

  it("export route filters by dependencyType=transitive", async () => {
    const { app, db } = await createTestContext();
    try {
      await insertTestProject(db, "proj-1");
      await seedScanResult(db, "proj-1", "lodash");

      await db
        .insert(vulnerabilities)
        .values([
          makeVulnerability({ projectId: "proj-1", packageName: "lodash", dedupKey: "d1" }),
          makeVulnerability({ projectId: "proj-1", packageName: "transitive-pkg", dedupKey: "d2" })
        ]);

      const response = await app.inject({
        method: "GET",
        url: "/api/vulnerabilities/export?format=json&dependencyType=transitive"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveLength(1);
      expect(body[0].packageName).toBe("transitive-pkg");
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/api/routes/__tests__/vulnerabilities.test.ts`
Expected: All tests pass including the 5 new ones.

- [ ] **Step 4: Run full suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/__tests__/vulnerabilities.test.ts
git commit -m "test(vulnerabilities): add dependencyType server-side filter tests"
```

---

### Task 2: Project Search Tests

**Files:**

- Modify: `src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts`

**Interfaces:**

- Consumes: `createPresenter()` helper, `getResult` mock data, `listProjectsRoute`
- Produces: Test coverage for `setSearchQuery` filtering

- [ ] **Step 1: Add search tests**

Add a new `describe` block at the end of the existing `describe("ProjectListPresenter")`:

```typescript
describe("search filtering", () => {
  function makeProject(overrides: Partial<ProjectsGateway.Project> = {}): ProjectsGateway.Project {
    return {
      id: generateId(),
      name: "my-app",
      path: "/projects/my-app",
      packageManager: "yarn",
      pmVersion: "4.0.0",
      lastScannedAt: null,
      hasNodeModules: false,
      security: null,
      teams: [],
      ...overrides
    };
  }

  it("shows all projects when search is empty", async () => {
    getResult = [
      makeProject({ id: "p1", name: "frontend" }),
      makeProject({ id: "p2", name: "backend" })
    ];
    const presenter = createPresenter();
    await presenter.load();
    expect(presenter.vm.projects).toHaveLength(2);
    expect(presenter.vm.searchQuery).toBe("");
  });

  it("filters projects by name", async () => {
    getResult = [
      makeProject({ id: "p1", name: "frontend-app" }),
      makeProject({ id: "p2", name: "backend-api" })
    ];
    const presenter = createPresenter();
    await presenter.load();
    presenter.setSearchQuery("frontend");
    expect(presenter.vm.projects).toHaveLength(1);
    expect(presenter.vm.projects[0].name).toBe("frontend-app");
  });

  it("filters projects by path", async () => {
    getResult = [
      makeProject({ id: "p1", name: "app", path: "/home/user/web" }),
      makeProject({ id: "p2", name: "lib", path: "/home/user/api" })
    ];
    const presenter = createPresenter();
    await presenter.load();
    presenter.setSearchQuery("/web");
    expect(presenter.vm.projects).toHaveLength(1);
    expect(presenter.vm.projects[0].name).toBe("app");
  });

  it("filters projects by package manager", async () => {
    getResult = [
      makeProject({ id: "p1", name: "app-a", packageManager: "yarn" }),
      makeProject({ id: "p2", name: "app-b", packageManager: "pnpm" })
    ];
    const presenter = createPresenter();
    await presenter.load();
    presenter.setSearchQuery("pnpm");
    expect(presenter.vm.projects).toHaveLength(1);
    expect(presenter.vm.projects[0].name).toBe("app-b");
  });

  it("search is case-insensitive", async () => {
    getResult = [
      makeProject({ id: "p1", name: "Frontend-App" }),
      makeProject({ id: "p2", name: "backend" })
    ];
    const presenter = createPresenter();
    await presenter.load();
    presenter.setSearchQuery("FRONTEND");
    expect(presenter.vm.projects).toHaveLength(1);
    expect(presenter.vm.projects[0].name).toBe("Frontend-App");
  });

  it("clearing search restores all projects", async () => {
    getResult = [
      makeProject({ id: "p1", name: "frontend" }),
      makeProject({ id: "p2", name: "backend" })
    ];
    const presenter = createPresenter();
    await presenter.load();
    presenter.setSearchQuery("frontend");
    expect(presenter.vm.projects).toHaveLength(1);
    presenter.setSearchQuery("");
    expect(presenter.vm.projects).toHaveLength(2);
  });
});
```

Add missing imports at top of file if not already present:

```typescript
import { generateId } from "@webiny/stdlib";
import type { ProjectsGateway } from "../../../../features/projects/abstractions/ProjectsGateway.js";
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts`
Expected: All tests pass including the 6 new ones.

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts
git commit -m "test(projects): add search query filtering tests"
```

---

### Task 3: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run type check**

Run: `npx tsc -b`
Expected: Clean.

- [ ] **Step 3: Format and commit docs**

```bash
npx prettier --write "src/**/*.{ts,tsx}"
git add docs/superpowers/specs/2026-08-04-export-tests-search-tests-di-design.md \
       docs/superpowers/plans/2026-08-04-export-tests-search-tests-di.md
git commit -m "docs: spec and plan for export tests, search tests"
```

If formatting changed source files:

```bash
git add -u
git commit -m "style: format changed files with prettier"
```

---

### Note: CustomStepResolver — Intentionally Not DI

`CustomStepResolver` is a factory-instantiated class — each instance takes runtime `type` (string) and `config` (ICustomStepConfig) that vary per upgrade session step. It's created dynamically via `new CustomStepResolver(type, config, commandRunner)` in `UpgradeSessionService.buildCustomResolvers()`. This pattern is correct and does not need DI conversion — `createAbstraction`/`createImplementation` is for singletons and known-at-registration-time services, not runtime factories.
