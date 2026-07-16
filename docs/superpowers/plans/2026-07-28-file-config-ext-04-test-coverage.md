# File Config Extension — Part 4: Test Coverage Gaps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill test coverage gaps for discoveredScripts filtering, workspace glob edge cases, PackageJsonService, and StepHooks UI layer.

**Architecture:** API-level integration tests (real Fastify + in-memory SQLite), service unit tests, and UI presenter/repository tests (mocked gateway).

**Tech Stack:** Vitest, Fastify inject, in-memory SQLite, MobX

## Global Constraints

- Yarn 4, oxlint, oxfmt
- Named interfaces only
- Work directly on main

---

### Task 1: discoveredScripts filtering in stepHooks route

**Files:**

- Modify: `src/api/routes/__tests__/stepHooks.test.ts`

**Interfaces:**

- Consumes: stepHooks route's `GET /api/projects/:id/step-hooks` response `{ items, configSource, discoveredScripts }`
- Produces: Tests only

- [ ] **Step 1: Add test — scripts filtered by existing DB hook names**

The test needs a project with a real path containing a `package.json` with scripts. Create a temp directory, write `package.json` with `{ "scripts": { "test": "vitest", "lint": "oxlint", "build": "tsc" } }`, insert the project row with that path.

```typescript
it("filters discoveredScripts by existing DB hook names", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
  try {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        scripts: { test: "vitest", lint: "oxlint", build: "tsc" }
      }),
      "utf-8"
    );

    await db
      .insert(projects)
      .values({
        id: "p-scripts",
        name: "test-project",
        path: tempDir,
        packageManager: "yarn",
        addedAt: Date.now()
      })
      .run();

    // Add a DB hook named "test"
    await db
      .insert(projectStepHooks)
      .values({
        id: "h-test",
        projectId: "p-scripts",
        position: "pre-upgrade",
        name: "test",
        command: "yarn test",
        type: "command",
        sortOrder: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/projects/p-scripts/step-hooks"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("db");
    const scriptNames = body.discoveredScripts.map((s: { name: string }) => s.name);
    expect(scriptNames).toContain("lint");
    expect(scriptNames).toContain("build");
    expect(scriptNames).not.toContain("test");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Add test — scripts filtered by file config hook names**

```typescript
it("filters discoveredScripts by file config hook names", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
  try {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        scripts: { test: "vitest", lint: "oxlint", build: "tsc" }
      }),
      "utf-8"
    );

    const fileConfig = {
      stepHooks: [
        {
          position: "pre-upgrade",
          name: "lint",
          command: "yarn lint",
          executionType: "command",
          required: false
        }
      ]
    };
    await writeFile(
      join(tempDir, ".dependency-upgrader.json"),
      JSON.stringify(fileConfig),
      "utf-8"
    );

    await db
      .insert(projects)
      .values({
        id: "p-file-scripts",
        name: "test-project",
        path: tempDir,
        packageManager: "yarn",
        addedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/projects/p-file-scripts/step-hooks"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("file");
    const scriptNames = body.discoveredScripts.map((s: { name: string }) => s.name);
    expect(scriptNames).toContain("test");
    expect(scriptNames).toContain("build");
    expect(scriptNames).not.toContain("lint");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Add test — empty discoveredScripts when no package.json scripts**

```typescript
it("returns empty discoveredScripts when package.json has no scripts", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
  try {
    await writeFile(join(tempDir, "package.json"), JSON.stringify({ name: "no-scripts" }), "utf-8");

    await db
      .insert(projects)
      .values({
        id: "p-no-scripts",
        name: "no-scripts",
        path: tempDir,
        packageManager: "yarn",
        addedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/projects/p-no-scripts/step-hooks"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.discoveredScripts).toEqual([]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 4: Add test — all scripts returned when no hooks configured**

```typescript
it("returns all discoveredScripts when no hooks are configured", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
  try {
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "all-scripts",
        scripts: { test: "vitest", lint: "oxlint" }
      }),
      "utf-8"
    );

    await db
      .insert(projects)
      .values({
        id: "p-all-scripts",
        name: "all-scripts",
        path: tempDir,
        packageManager: "yarn",
        addedAt: Date.now()
      })
      .run();

    const response = await app.inject({
      method: "GET",
      url: "/api/projects/p-all-scripts/step-hooks"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.discoveredScripts).toHaveLength(2);
    const scriptNames = body.discoveredScripts.map((s: { name: string }) => s.name);
    expect(scriptNames).toContain("test");
    expect(scriptNames).toContain("lint");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/routes/__tests__/stepHooks.test.ts`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/__tests__/stepHooks.test.ts
git commit -m "test: discoveredScripts filtering in stepHooks route"
```

### Task 2: Workspace glob edge cases in filesystem route

**Files:**

- Modify: `src/api/routes/__tests__/filesystem.test.ts`

**Interfaces:**

- Consumes: filesystem scan route
- Produces: Tests only

- [ ] **Step 1: Add test — double-star glob pattern**

```typescript
it("resolves ** glob patterns matching nested directories", async () => {
  writeFileSync(
    join(scanDir, "package.json"),
    JSON.stringify({ workspaces: ["packages/**"] }),
    "utf-8"
  );
  mkdirSync(join(scanDir, "packages", "core", "sub-pkg"), { recursive: true });
  writeFileSync(join(scanDir, "packages", "core", "sub-pkg", "package.json"), "{}", "utf-8");
  mkdirSync(join(scanDir, "packages", "utils"), { recursive: true });
  writeFileSync(join(scanDir, "packages", "utils", "package.json"), "{}", "utf-8");

  const response = await app.inject({
    method: "GET",
    url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.mode).toBe("workspaces");
  const names = body.items.map((i: { name: string }) => i.name).sort();
  expect(names).toContain("sub-pkg");
  expect(names).toContain("utils");
});
```

- [ ] **Step 2: Add test — exclude patterns**

```typescript
it("excludes workspace patterns starting with !", async () => {
  writeFileSync(
    join(scanDir, "package.json"),
    JSON.stringify({ workspaces: ["packages/*", "!packages/excluded"] }),
    "utf-8"
  );
  mkdirSync(join(scanDir, "packages", "included"), { recursive: true });
  writeFileSync(join(scanDir, "packages", "included", "package.json"), "{}", "utf-8");
  mkdirSync(join(scanDir, "packages", "excluded"), { recursive: true });
  writeFileSync(join(scanDir, "packages", "excluded", "package.json"), "{}", "utf-8");

  const response = await app.inject({
    method: "GET",
    url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.mode).toBe("workspaces");
  const names = body.items.map((i: { name: string }) => i.name);
  expect(names).toContain("included");
  expect(names).not.toContain("excluded");
});
```

- [ ] **Step 3: Add test — workspaces.packages object form**

```typescript
it("reads workspace patterns from workspaces.packages object form", async () => {
  writeFileSync(
    join(scanDir, "package.json"),
    JSON.stringify({ workspaces: { packages: ["apps/*"] } }),
    "utf-8"
  );
  mkdirSync(join(scanDir, "apps", "web"), { recursive: true });
  writeFileSync(join(scanDir, "apps", "web", "package.json"), "{}", "utf-8");

  const response = await app.inject({
    method: "GET",
    url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.mode).toBe("workspaces");
  expect(body.items).toHaveLength(1);
  expect(body.items[0].name).toBe("web");
});
```

- [ ] **Step 4: Add test — dedup across overlapping patterns**

```typescript
it("deduplicates items matched by overlapping workspace patterns", async () => {
  writeFileSync(
    join(scanDir, "package.json"),
    JSON.stringify({ workspaces: ["packages/*", "packages/shared"] }),
    "utf-8"
  );
  mkdirSync(join(scanDir, "packages", "shared"), { recursive: true });
  writeFileSync(join(scanDir, "packages", "shared", "package.json"), "{}", "utf-8");
  mkdirSync(join(scanDir, "packages", "core"), { recursive: true });
  writeFileSync(join(scanDir, "packages", "core", "package.json"), "{}", "utf-8");

  const response = await app.inject({
    method: "GET",
    url: `/api/filesystem/scan?path=${encodeURIComponent(scanDir)}`
  });

  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.mode).toBe("workspaces");
  const names = body.items.map((i: { name: string }) => i.name).sort();
  expect(names).toEqual(["core", "shared"]);
});
```

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/routes/__tests__/filesystem.test.ts`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/__tests__/filesystem.test.ts
git commit -m "test: workspace glob edge cases — **, exclude patterns, object form, dedup"
```

### Task 3: StepHooks UI presenter/repository tests

**Files:**

- Create: `src/ui/presentation/projects/StepHooks/__tests__/StepHooksPresenter.test.ts`
- Modify: `src/ui/features/stepHooks/__tests__/StepHooksRepository.test.ts` (verify discoveredScripts coverage)

**Interfaces:**

- Consumes: `StepHooksGateway.list()` returns `{ hooks, configSource, discoveredScripts }`
- Produces: Tests only

- [ ] **Step 1: Create StepHooksPresenter test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { StepHooksPresenter as AbstractPresenter } from "../abstractions/StepHooksPresenter.js";
import { StepHooksPresenter } from "../StepHooksPresenter.js";
import { StepHooksGateway } from "../../../../features/stepHooks/abstractions/StepHooksGateway.js";
import { StepHooksRepository as AbstractRepository } from "../../../../features/stepHooks/abstractions/StepHooksRepository.js";
import { StepHooksRepository } from "../../../../features/stepHooks/StepHooksRepository.js";

function createMockGateway(): StepHooksGateway.Interface {
  return {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  };
}

describe("StepHooksPresenter", () => {
  let presenter: AbstractPresenter.Interface;
  let mockGateway: ReturnType<typeof createMockGateway>;

  beforeEach(() => {
    mockGateway = createMockGateway();
    const container = createContainer();
    container.registerInstance(StepHooksGateway, mockGateway);
    container.register(StepHooksRepository).inSingletonScope();
    container.register(StepHooksPresenter).inSingletonScope();
    presenter = container.resolve(AbstractPresenter);
  });

  it("load populates discoveredScripts in vm", async () => {
    (mockGateway.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      hooks: [],
      configSource: "db",
      discoveredScripts: [
        { name: "test", command: "vitest" },
        { name: "lint", command: "oxlint" }
      ]
    });

    await presenter.load("p1");

    expect(presenter.vm.discoveredScripts).toHaveLength(2);
    expect(presenter.vm.discoveredScripts[0]!.name).toBe("test");
    expect(presenter.vm.discoveredScripts[1]!.name).toBe("lint");
  });

  it("load sets configSource file when file config active", async () => {
    (mockGateway.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      hooks: [
        {
          id: "file-0",
          projectId: "p1",
          position: "pre-upgrade",
          name: "Lint",
          command: "yarn lint",
          type: "command",
          required: true,
          enabled: true,
          sortOrder: 0,
          source: "file",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      configSource: "file",
      discoveredScripts: []
    });

    await presenter.load("p1");

    expect(presenter.vm.configSource).toBe("file");
  });

  it("openFormWithDefaults pre-fills form defaults", () => {
    presenter.openFormWithDefaults({
      name: "test",
      command: "yarn test",
      type: "package-script"
    });

    expect(presenter.vm.formOpen).toBe(true);
    expect(presenter.vm.formDefaults).toEqual({
      name: "test",
      command: "yarn test",
      type: "package-script"
    });
    expect(presenter.vm.editingHookId).toBeNull();
  });

  it("closeForm clears formDefaults", () => {
    presenter.openFormWithDefaults({
      name: "test",
      command: "yarn test",
      type: "package-script"
    });
    presenter.closeForm();

    expect(presenter.vm.formOpen).toBe(false);
    expect(presenter.vm.formDefaults).toBeNull();
  });
});
```

- [ ] **Step 2: Verify StepHooksRepository test has discoveredScripts coverage**

Check `src/ui/features/stepHooks/__tests__/StepHooksRepository.test.ts` — if it already tests `getDiscoveredScripts`/`setDiscoveredScripts`, no changes needed. If not, add:

```typescript
it("stores and retrieves discoveredScripts", () => {
  const scripts = [
    { name: "test", command: "vitest" },
    { name: "lint", command: "oxlint" }
  ];
  repository.setDiscoveredScripts(scripts);
  expect(repository.getDiscoveredScripts()).toEqual(scripts);
});
```

- [ ] **Step 3: Run tests**

Run: `yarn test src/ui/presentation/projects/StepHooks/__tests__/StepHooksPresenter.test.ts src/ui/features/stepHooks/__tests__/StepHooksRepository.test.ts`
Expected: All pass.

- [ ] **Step 4: Run full pipeline**

Run: `yarn full`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/projects/StepHooks/__tests__/StepHooksPresenter.test.ts src/ui/features/stepHooks/__tests__/StepHooksRepository.test.ts
git commit -m "test: StepHooksPresenter discoveredScripts and formDefaults, repository coverage"
```
