# Editable PM Settings — API Write Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a write path for PM settings — extend `FileConfigService` with `writeGlobalPmSettings()`, add `PUT /api/settings/pm/:pm` route, add shared route definition.

**Architecture:** `FileConfigService` gets a new write method that reads the full `.dependency-upgrader.json`, deep-merges the PM section, and writes back. New PUT route validates input and delegates. Auto-creates file if missing.

**Tech Stack:** Fastify, Zod, `JsonFileTool` from `@webiny/stdlib`, Vitest

## Global Constraints

- All types must use named interfaces, never inline structural types
- This project uses yarn, not npm
- Work directly on main, no feature branches or git worktrees
- `.strict()` on file config schema — unknown keys rejected
- Security fields excluded from write path (DB-backed CRUD already exists)

---

### Task 1: Extend FileConfigService abstraction + implementation with write method

**Files:**

- Modify: `src/api/services/abstractions/FileConfigService.ts:49-53`
- Modify: `src/api/services/FileConfigService.ts:164-234`
- Test: `src/api/services/__tests__/FileConfigService.test.ts`

**Interfaces:**

- Consumes: `JsonFileTool.Interface` (existing — `readJson()`, `writeJson()`)
- Consumes: `IFilePmSettings` (existing — `{ security?, installFlags?, registryUrl?, upgradeStrategy? }`)
- Consumes: `PackageManagerId` from `#shared/security/index.js` (existing — `"yarn" | "npm" | "pnpm" | "bun"`)
- Produces: `writeGlobalPmSettings(pm: PackageManagerId, settings: IFilePmSettings): Promise<void>` — added to `IFileConfigService`

- [ ] **Step 1: Write tests for writeGlobalPmSettings**

Add to `src/api/services/__tests__/FileConfigService.test.ts`:

```ts
describe("writeGlobalPmSettings", () => {
  it("creates file with pmSettings when file does not exist", async () => {
    await service.writeGlobalPmSettings("pnpm", {
      installFlags: { "--frozen-lockfile": true }
    });

    const result = await service.readGlobalConfig();
    expect(result.config?.pmSettings?.pnpm?.installFlags).toEqual({
      "--frozen-lockfile": true
    });
  });

  it("merges into existing file preserving other sections", async () => {
    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    await writeFile(
      configPath,
      JSON.stringify({
        settings: { logLevel: "info" },
        pmSettings: {
          yarn: { registryUrl: "https://yarn.example.com" }
        }
      }),
      "utf-8"
    );

    await service.writeGlobalPmSettings("pnpm", {
      upgradeStrategy: "exact"
    });

    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw.settings.logLevel).toBe("info");
    expect(raw.pmSettings.yarn.registryUrl).toBe("https://yarn.example.com");
    expect(raw.pmSettings.pnpm.upgradeStrategy).toBe("exact");
  });

  it("merges into existing PM section preserving other PM fields", async () => {
    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    await writeFile(
      configPath,
      JSON.stringify({
        pmSettings: {
          pnpm: {
            registryUrl: "https://existing.com",
            installFlags: { "--force": true }
          }
        }
      }),
      "utf-8"
    );

    await service.writeGlobalPmSettings("pnpm", {
      upgradeStrategy: "tilde"
    });

    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw.pmSettings.pnpm.registryUrl).toBe("https://existing.com");
    expect(raw.pmSettings.pnpm.installFlags).toEqual({ "--force": true });
    expect(raw.pmSettings.pnpm.upgradeStrategy).toBe("tilde");
  });

  it("overwrites existing field in PM section", async () => {
    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    await writeFile(
      configPath,
      JSON.stringify({
        pmSettings: {
          pnpm: { upgradeStrategy: "caret" }
        }
      }),
      "utf-8"
    );

    await service.writeGlobalPmSettings("pnpm", {
      upgradeStrategy: "exact"
    });

    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw.pmSettings.pnpm.upgradeStrategy).toBe("exact");
  });

  it("invalidates cache after write", async () => {
    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    await writeFile(
      configPath,
      JSON.stringify({ pmSettings: { yarn: { upgradeStrategy: "caret" } } }),
      "utf-8"
    );

    // Prime cache
    const before = await service.readGlobalConfig();
    expect(before.config?.pmSettings?.yarn?.upgradeStrategy).toBe("caret");

    await service.writeGlobalPmSettings("yarn", { upgradeStrategy: "exact" });

    // Should read fresh, not cached
    const after = await service.readGlobalConfig();
    expect(after.config?.pmSettings?.yarn?.upgradeStrategy).toBe("exact");
  });
});
```

Note: check what imports are already at the top of this test file. You will likely need to add `readFile` from `node:fs/promises` and get a reference to `service` from the existing setup. Follow the test file's existing `beforeEach` pattern for the `service` variable.

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: FAIL — `writeGlobalPmSettings` does not exist

- [ ] **Step 3: Add writeGlobalPmSettings to abstraction interface**

In `src/api/services/abstractions/FileConfigService.ts`, add to `IFileConfigService`:

```ts
writeGlobalPmSettings(pm: PackageManagerId, settings: IFilePmSettings): Promise<void>;
```

Add the import at the top:

```ts
import type { PackageManagerId } from "#shared/security/index.js";
```

- [ ] **Step 4: Implement writeGlobalPmSettings in FileConfigServiceImpl**

In `src/api/services/FileConfigService.ts`, add method to `FileConfigServiceImpl`:

```ts
public async writeGlobalPmSettings(
    pm: PackageManagerId,
    settings: IFilePmSettings
): Promise<void> {
    const configPath = join(process.cwd(), CONFIG_FILENAME);
    const existing = this.jsonFileTool.readJson<Record<string, unknown>>(configPath) ?? {};
    const existingPmSettings = (existing.pmSettings as Record<string, unknown>) ?? {};
    const existingPm = (existingPmSettings[pm] as Record<string, unknown>) ?? {};

    existing.pmSettings = {
        ...existingPmSettings,
        [pm]: { ...existingPm, ...settings }
    };

    this.jsonFileTool.writeJson(configPath, existing);
    this.cachedResult = null;
    this.cachedAt = 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/abstractions/FileConfigService.ts src/api/services/FileConfigService.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: add writeGlobalPmSettings to FileConfigService"
```

---

### Task 2: Add PUT route definition + route handler

**Files:**

- Modify: `src/shared/routes/pmSettings.ts`
- Modify: `src/api/routes/settings.ts`
- Test: `src/api/routes/__tests__/settings.test.ts`

**Interfaces:**

- Consumes: `FileConfigService.Interface` (existing + new `writeGlobalPmSettings()` from Task 1)
- Consumes: `listPmSettingsRoute` handler pattern (existing — `src/api/routes/settings.ts:310`)
- Produces: `updatePmConfigRoute` — `PUT /api/settings/pm/:pm` with body `{ installFlags?, registryUrl?, upgradeStrategy? }`

- [ ] **Step 1: Write tests for PUT /api/settings/pm/:pm**

Add to `src/api/routes/__tests__/settings.test.ts`, inside the existing `describe("settings routes")` block:

```ts
describe("PUT /api/settings/pm/:pm", () => {
  it("writes install flags to config file", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/pm/pnpm",
      payload: {
        installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true }
      }
    });

    expect(response.statusCode).toBe(200);

    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw.pmSettings.pnpm.installFlags).toEqual({
      "--frozen-lockfile": true,
      "--ignore-scripts": true
    });
  });

  it("writes registryUrl to config file", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/pm/yarn",
      payload: {
        registryUrl: "https://custom.registry.com"
      }
    });

    expect(response.statusCode).toBe(200);
    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw.pmSettings.yarn.registryUrl).toBe("https://custom.registry.com");
  });

  it("writes upgradeStrategy to config file", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/pm/npm",
      payload: {
        upgradeStrategy: "exact"
      }
    });

    expect(response.statusCode).toBe(200);
    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    const raw = JSON.parse(await readFile(configPath, "utf-8"));
    expect(raw.pmSettings.npm.upgradeStrategy).toBe("exact");
  });

  it("rejects invalid package manager", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/pm/invalid",
      payload: { upgradeStrategy: "caret" }
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects invalid upgradeStrategy value", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/pm/yarn",
      payload: { upgradeStrategy: "invalid" }
    });

    expect(response.statusCode).toBe(400);
  });

  it("returns updated PM config after write", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/pm/pnpm",
      payload: {
        installFlags: { "--frozen-lockfile": true },
        upgradeStrategy: "tilde"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.item.packageManager).toBe("pnpm");
    expect(body.item.general.upgradeStrategy).toBe("tilde");
  });
});
```

Note: you will need to add `readFile` to the existing `node:fs/promises` import at the top of this test file. Also add cleanup in `afterEach` to remove `.dependency-upgrader.json` if it exists (check if this is already handled — the existing tests already do `rm(configPath, { force: true })` in `try/finally` blocks, but for the PUT tests you should add cleanup in `afterEach`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/api/routes/__tests__/settings.test.ts`
Expected: FAIL — route not found (404)

- [ ] **Step 3: Add updatePmConfigRoute definition**

In `src/shared/routes/pmSettings.ts`, add after `listPmSettingsRoute`:

```ts
const updatePmConfigBodySchema = z.object({
  installFlags: z.record(z.string(), z.boolean()).optional(),
  registryUrl: z.string().url().optional(),
  upgradeStrategy: z.enum(["caret", "tilde", "exact", "latest"]).optional()
});

export const updatePmConfigRoute = defineRoute({
  method: "PUT",
  path: "/api/settings/pm/:pm",
  description: "Update PM config in .dependency-upgrader.json",
  params: z.object({
    pm: z.enum(["yarn", "npm", "pnpm", "bun"])
  }),
  body: updatePmConfigBodySchema,
  response: z.object({
    item: pmConfigItemSchema
  })
});
```

- [ ] **Step 4: Add PUT handler in settings.ts**

In `src/api/routes/settings.ts`, add the import for `updatePmConfigRoute`:

```ts
import { listPmSettingsRoute, updatePmConfigRoute } from "#shared/routes/index.js";
```

Add the handler after the `listPmSettingsRoute` handler (after line ~356):

```ts
registerRoute(app, updatePmConfigRoute, {}, async (request, reply) => {
  const { pm } = request.params;
  const fileConfigService = container.resolve(FileConfigService);

  await fileConfigService.writeGlobalPmSettings(pm, request.body);

  const fileConfigResult = await fileConfigService.readGlobalConfig();
  const allPmSettings = fileConfigResult.config?.pmSettings;
  const registry = INSTALL_FLAG_REGISTRY[pm];
  const fileConfig = allPmSettings?.[pm];

  const installFlags: InstallFlagItemResponse[] = registry.map(flag => {
    const fileValue = fileConfig?.installFlags?.[flag.flag];
    return {
      flag: flag.flag,
      label: flag.label,
      description: flag.description,
      enabled: fileValue ?? flag.defaultEnabled,
      defaultEnabled: flag.defaultEnabled,
      isFileManaged: fileValue !== undefined
    };
  });

  const item: PmConfigItemResponse = {
    packageManager: pm,
    installFlags,
    general: {
      registryUrl: fileConfig?.registryUrl ?? null,
      upgradeStrategy: fileConfig?.upgradeStrategy ?? null
    }
  };

  sendOne(reply, item);
});
```

Note: check what types `InstallFlagItemResponse` and `PmConfigItemResponse` are — they may be inline interfaces defined near the top of `settings.ts`. Look at how the existing `listPmSettingsRoute` handler builds its response and follow the same pattern.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/api/routes/__tests__/settings.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite + checks**

Run: `yarn vitest run && yarn lint && yarn format:check && yarn build`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add src/shared/routes/pmSettings.ts src/api/routes/settings.ts src/api/routes/__tests__/settings.test.ts
git commit -m "feat: add PUT /api/settings/pm/:pm route for writing PM config"
```
