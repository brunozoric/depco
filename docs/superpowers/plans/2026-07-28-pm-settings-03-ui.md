# PM Settings Part 3: UI — Rename to PM Settings, Add Tabs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename SecuritySettings to PM Settings throughout the UI, add tabbed interface with Security / Install / General tabs, wire new per-PM data through gateway/repository/presenter/page.

**Architecture:** Existing SecuritySettings infrastructure becomes the Security tab within a broader PM Settings page. New Install and General tabs display file-config-only data (read-only). Gateway fetches additional PM config. Presenter exposes tab-specific view models.

**Tech Stack:** MobX, React (`observer`), Mantine UI (Tabs, Alert, Table, Badge, Text)

## Global Constraints

- Gateway: `HTTPClient.request(route, args)` typed calls
- Repository: plain in-memory state
- Presenter: MobX `makeAutoObservable`, `vm` computed, arrow methods
- React: dumb display, `observer()` wrapped, reads `presenter.vm` only
- UI tests: mock `HTTPClient` at DI level, real everything else
- All interfaces in `abstractions/` directory
- `yarn vitest run` for tests, `yarn build` for type checking
- This project uses yarn, not npm

---

### Task 7: Add PM settings API route for install flags and general settings

**Files:**

- Create: `src/shared/routes/pmSettings.ts` — new route definition
- Modify: `src/shared/routes/index.ts` — export new route
- Modify: `src/api/routes/settings.ts` — add handler for new route
- Test: `src/api/routes/__tests__/settings.test.ts`

**Interfaces:**

- Consumes: `FileConfigService.readGlobalConfig()`, `INSTALL_FLAG_REGISTRY`
- Produces: `listPmSettingsRoute` returning per-PM install flags + general settings from file config

- [ ] **Step 1: Define the route schema**

Create `src/shared/routes/pmSettings.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const installFlagItemSchema = z.object({
  flag: z.string(),
  label: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  defaultEnabled: z.boolean(),
  isFileManaged: z.boolean()
});

const pmGeneralSettingsSchema = z.object({
  registryUrl: z.string().nullable(),
  upgradeStrategy: z.string().nullable()
});

const pmConfigItemSchema = z.object({
  packageManager: z.string(),
  installFlags: z.array(installFlagItemSchema),
  general: pmGeneralSettingsSchema
});

export const listPmSettingsRoute = defineRoute({
  method: "GET",
  path: "/api/settings/pm",
  description: "List per-PM install flags and general settings",
  params: z.object({}),
  response: z.object({
    items: z.array(pmConfigItemSchema),
    configSource: z.enum(["db", "file", "error"]),
    fileManagedPms: z.array(z.string()),
    configError: z
      .object({
        type: z.enum(["json", "schema"]),
        message: z.string()
      })
      .optional()
  })
});
```

- [ ] **Step 2: Export from index**

In `src/shared/routes/index.ts`, add:

```typescript
export { listPmSettingsRoute } from "./pmSettings.js";
```

- [ ] **Step 3: Write failing test**

```typescript
describe("GET /api/settings/pm", () => {
  it("returns default install flags for all PMs when no file config", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/settings/pm"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.configSource).toBe("db");
    expect(body.fileManagedPms).toEqual([]);
    expect(body.items.length).toBe(4); // one per PM
    const pnpm = body.items.find((i: { packageManager: string }) => i.packageManager === "pnpm");
    expect(pnpm.installFlags.length).toBe(4);
    expect(pnpm.installFlags.every((f: { isFileManaged: boolean }) => !f.isFileManaged)).toBe(true);
    expect(pnpm.general.registryUrl).toBeNull();
    expect(pnpm.general.upgradeStrategy).toBeNull();
  });

  it("returns file-managed flags when file config present", async () => {
    const configPath = join(process.cwd(), ".dependency-upgrader.json");
    await writeFile(
      configPath,
      JSON.stringify({
        pmSettings: {
          pnpm: {
            installFlags: { "--frozen-lockfile": true, "--ignore-scripts": true },
            registryUrl: "https://custom.registry.com",
            upgradeStrategy: "exact"
          }
        }
      }),
      "utf-8"
    );

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/settings/pm"
      });

      const body = response.json();
      expect(body.configSource).toBe("file");
      expect(body.fileManagedPms).toEqual(["pnpm"]);

      const pnpm = body.items.find((i: { packageManager: string }) => i.packageManager === "pnpm");
      const frozen = pnpm.installFlags.find(
        (f: { flag: string }) => f.flag === "--frozen-lockfile"
      );
      expect(frozen.enabled).toBe(true);
      expect(frozen.isFileManaged).toBe(true);
      expect(pnpm.general.registryUrl).toBe("https://custom.registry.com");
      expect(pnpm.general.upgradeStrategy).toBe("exact");
    } finally {
      await rm(configPath, { force: true });
    }
  });
});
```

- [ ] **Step 4: Implement route handler**

In `src/api/routes/settings.ts`, add handler:

```typescript
import { listPmSettingsRoute } from "#shared/routes/index.js";
import { INSTALL_FLAG_REGISTRY } from "#shared/install/index.js";

registerRoute(app, listPmSettingsRoute, {}, async (_request, reply) => {
  const fileConfigService = container.resolve(FileConfigService);
  const fileConfigResult = await fileConfigService.readGlobalConfig();

  if (fileConfigResult.error) {
    // Return defaults with error
    const items = buildDefaultPmItems();
    reply.send({
      items,
      configSource: "error" as const,
      fileManagedPms: [],
      configError: fileConfigResult.error
    });
    return;
  }

  const allPmSettings = fileConfigResult.config?.pmSettings;
  const fileManagedPms = allPmSettings ? Object.keys(allPmSettings) : [];
  const configSource = fileManagedPms.length > 0 ? ("file" as const) : ("db" as const);

  const pms: PackageManagerId[] = ["yarn", "npm", "pnpm", "bun"];
  const items = pms.map(pm => {
    const fileConfig = allPmSettings?.[pm];
    const registry = INSTALL_FLAG_REGISTRY[pm];
    const isManaged = fileManagedPms.includes(pm);

    const installFlags = registry.map(flag => {
      const fileValue = fileConfig?.installFlags?.[flag.flag];
      return {
        flag: flag.flag,
        label: flag.label,
        description: flag.description,
        enabled: fileValue ?? flag.defaultEnabled,
        defaultEnabled: flag.defaultEnabled,
        isFileManaged: isManaged && fileValue !== undefined
      };
    });

    return {
      packageManager: pm,
      installFlags,
      general: {
        registryUrl: fileConfig?.registryUrl ?? null,
        upgradeStrategy: fileConfig?.upgradeStrategy ?? null
      }
    };
  });

  reply.send({ items, configSource, fileManagedPms });
});
```

Add helper:

```typescript
function buildDefaultPmItems() {
  const pms: PackageManagerId[] = ["yarn", "npm", "pnpm", "bun"];
  return pms.map(pm => ({
    packageManager: pm,
    installFlags: INSTALL_FLAG_REGISTRY[pm].map(flag => ({
      flag: flag.flag,
      label: flag.label,
      description: flag.description,
      enabled: flag.defaultEnabled,
      defaultEnabled: flag.defaultEnabled,
      isFileManaged: false
    })),
    general: { registryUrl: null, upgradeStrategy: null }
  }));
}
```

- [ ] **Step 5: Run tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/pmSettings.ts src/shared/routes/index.ts src/api/routes/settings.ts src/api/routes/__tests__/settings.test.ts
git commit -m "feat: add PM settings API route for install flags and general settings"
```

---

### Task 8: Rename SecuritySettings to PM Settings in UI infrastructure

**Files:**

- Modify: all SecuritySettings UI files (gateway, repository, use cases, presenter, feature, provider, page)
- Test: update existing presenter tests

**Interfaces:**

- Consumes: existing SecuritySettings infrastructure
- Produces: renamed to PmSettings throughout — component names, abstraction tokens, feature registrations, nav entries

This is a mechanical rename task. The key changes:

- [ ] **Step 1: Read all SecuritySettings files to understand the full rename scope**

Read every file in:

- `src/ui/features/settings/` (gateway, repository, abstractions, feature)
- `src/ui/presentation/settings/SecuritySettings/` (presenter, provider, page, abstractions, feature)
- `src/ui/presentation/settings/useCases/` (load, create, update, toggle, reset use cases)

Map every occurrence of "SecuritySettings" / "securitySettings" / "security-settings".

- [ ] **Step 2: Rename files and update all references**

Rename directories and files:

- `src/ui/presentation/settings/SecuritySettings/` → `src/ui/presentation/settings/PmSettings/`
- All files inside: `SecuritySettingsPresenter.ts` → `PmSettingsPresenter.ts`, etc.
- Abstraction tokens: `"Ui/SecuritySettingsPresenter"` → `"Ui/PmSettingsPresenter"`, etc.

Update all imports across the codebase that reference these files.

Update navigation/routing if applicable — check how the settings page is routed.

- [ ] **Step 3: Update page title**

In the page component, change "Security Settings" title to "PM Settings".

- [ ] **Step 4: Run full suite**

Run: `yarn vitest run && yarn build`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename SecuritySettings to PmSettings throughout UI"
```

---

### Task 9: Add tabbed interface to PM Settings page

**Files:**

- Modify: PM Settings page component (renamed in Task 8)
- Modify: PM Settings presenter (add tab-specific VM fields)
- Modify: PM Settings gateway (fetch from `listPmSettingsRoute`)
- Modify: PM Settings repository (store install flags + general settings)
- Test: extend presenter tests

**Interfaces:**

- Consumes: `listPmSettingsRoute` (Task 7), existing security settings gateway
- Produces: tabbed PM Settings page with Security / Install / General tabs

- [ ] **Step 1: Extend gateway to fetch PM settings**

Add method to gateway:

```typescript
listPmConfig(): Promise<IPmConfigListResult>;
```

Where `IPmConfigListResult` carries the install flags and general settings per PM.

- [ ] **Step 2: Extend repository to store PM config**

Add methods:

```typescript
getPmConfigs(): IPmConfigItem[];
setPmConfigs(items: IPmConfigItem[]): void;
```

- [ ] **Step 3: Add LoadPmConfigUseCase**

Fetches from gateway, stores in repository. Same pattern as `LoadSecuritySettingsUseCase`.

- [ ] **Step 4: Extend presenter VM**

Add to view model:

```typescript
activeTab: "security" | "install" | "general";
installFlags: IInstallFlagViewModel[];
generalSettings: { registryUrl: string | null; upgradeStrategy: string | null };
```

Add method:

```typescript
setActiveTab: (tab: "security" | "install" | "general") => void;
```

Install flags and general settings are filtered by `selectedPackageManager`, same as security settings.

- [ ] **Step 5: Update page component**

Add Mantine `Tabs` component:

```tsx
<Tabs value={vm.activeTab} onChange={v => presenter.setActiveTab(v as any)}>
  <Tabs.List>
    <Tabs.Tab value="security">Security</Tabs.Tab>
    <Tabs.Tab value="install">Install</Tabs.Tab>
    <Tabs.Tab value="general">General</Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel value="security">{/* existing security settings table */}</Tabs.Panel>

  <Tabs.Panel value="install">
    {/* install flags table — flag, label, enabled badge, default badge, file-managed badge */}
  </Tabs.Panel>

  <Tabs.Panel value="general">{/* registry URL + upgrade strategy display */}</Tabs.Panel>
</Tabs>
```

Install tab shows a table of flags with their current and default states. Read-only when file-managed.

General tab shows registry URL and upgrade strategy. Read-only when file-managed.

- [ ] **Step 6: Write presenter tests**

```typescript
it("vm.activeTab defaults to security", () => {
  const presenter = createPresenter();
  expect(presenter.vm.activeTab).toBe("security");
});

it("setActiveTab changes vm.activeTab", () => {
  const presenter = createPresenter();
  presenter.setActiveTab("install");
  expect(presenter.vm.activeTab).toBe("install");
});

it("vm.installFlags shows flags for selected PM", async () => {
  // Mock PM config response with pnpm install flags
  // Load presenter
  // Select pnpm
  // Verify vm.installFlags has pnpm flags
});

it("vm.generalSettings shows registry URL and strategy for selected PM", async () => {
  // Mock PM config response with pnpm general settings
  // Load presenter
  // Select pnpm
  // Verify vm.generalSettings has registryUrl and upgradeStrategy
});
```

- [ ] **Step 7: Run all tests**

Run: `yarn vitest run && yarn build`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add tabbed PM Settings page with Security, Install, and General tabs"
```
