# Security File Config Part 1: FileConfigService — Schema, Cache, Result Types

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend FileConfigService with security settings schema, 10s TTL cache, result types for error surfacing, and JsonFileTool DI integration.

**Architecture:** FileConfigService gains `readGlobalConfig()` returning `IFileConfigResult` (config + optional error). Security settings validated against `SECURITY_FIELD_REGISTRY`. Cache at service level replaces AppLogService's private cache.

**Tech Stack:** Zod, `@webiny/stdlib/node` JsonFileTool, `@webiny/di`

## Global Constraints

- All interfaces in `abstractions/` directory, one file per token
- Never inline structural types — always named interfaces
- Test with real DI container (`createContainer()`), never `new XxxImpl()`
- `yarn test` / `yarn lint` / `yarn typecheck` must pass after each task

---

### Task 1: Extend abstraction with new types and `readGlobalConfig()` method

**Files:**

- Modify: `src/api/services/abstractions/FileConfigService.ts`
- Test: `src/api/services/__tests__/FileConfigService.test.ts`

**Interfaces:**

- Consumes: existing `IFileSettings`, `IProjectFileConfig`, `IFileConfigService`
- Produces: `IFileSecuritySettings`, `IFileConfigError`, `IFileConfigResult`, `IFileSettingsResult`, updated `IProjectFileConfig` with `securitySettings?`, updated `IFileConfigService` with `readGlobalConfig()` and updated `readGlobalSettings()` return type

- [ ] **Step 1: Write failing test for `readGlobalConfig()` returning null when no file**

In `src/api/services/__tests__/FileConfigService.test.ts`, add a new describe block:

```typescript
describe("readGlobalConfig", () => {
  it("returns config null and no error when no file exists", async () => {
    const result = await service.readGlobalConfig();
    expect(result.config).toBeNull();
    expect(result.error).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: FAIL — `readGlobalConfig` does not exist on type

- [ ] **Step 3: Add types and method to abstraction**

In `src/api/services/abstractions/FileConfigService.ts`, add new interfaces and update existing ones:

```typescript
export interface IFileSecuritySettings {
  [packageManager: string]: {
    [fieldName: string]: string;
  };
}

export interface IFileConfigError {
  type: "json" | "schema";
  message: string;
}

export interface IFileConfigResult {
  config: IProjectFileConfig | null;
  error?: IFileConfigError;
}

export interface IFileSettingsResult {
  settings: IFileSettings | null;
  error?: IFileConfigError;
}
```

Add `securitySettings?: IFileSecuritySettings` to `IProjectFileConfig`.

Add `readGlobalConfig(): Promise<IFileConfigResult>` to `IFileConfigService`.

Change `readGlobalSettings()` return type to `Promise<IFileSettingsResult>`.

Update namespace exports:

```typescript
export namespace FileConfigService {
  export type Interface = IFileConfigService;
  export type FileConfig = IProjectFileConfig;
  export type StepHook = IFileStepHook;
  export type Settings = IFileSettings;
  export type SecuritySettings = IFileSecuritySettings;
  export type ConfigError = IFileConfigError;
  export type ConfigResult = IFileConfigResult;
  export type SettingsResult = IFileSettingsResult;
}
```

- [ ] **Step 4: Stub `readGlobalConfig()` in FileConfigServiceImpl**

In `src/api/services/FileConfigService.ts`, add minimal stub that makes test pass:

```typescript
public async readGlobalConfig(): Promise<IFileConfigResult> {
    const settings = await this.readGlobalSettings();
    return { config: null };
}
```

This is temporary — will be properly implemented in Task 2.

- [ ] **Step 5: Update `readGlobalSettings()` return type**

Change `readGlobalSettings()` to return `IFileSettingsResult`:

```typescript
public async readGlobalSettings(): Promise<IFileSettingsResult> {
    // existing implementation wraps in result type
    // return { settings: <existing result>, error: undefined }
}
```

Update the body to wrap the existing `return config.settings ?? null` in `{ settings: ... }`.

- [ ] **Step 6: Fix all callers of `readGlobalSettings()`**

Two callers to update:

1. `src/api/routes/appSettings.ts:36` — change `fileSettings` to `fileSettingsResult`, access `.settings`:

```typescript
const fileSettingsResult = await fileConfigService.readGlobalSettings();
const fileSettings = fileSettingsResult.settings;
```

2. `src/api/services/AppLogService.ts:74` — change to access `.settings`:

```typescript
const fileSettingsResult = await this.fileConfigService.readGlobalSettings();
if (fileSettingsResult.settings?.logLevel) {
    this.cachedLevel = fileSettingsResult.settings.logLevel;
```

- [ ] **Step 7: Run all tests**

Run: `yarn vitest run`
Expected: all pass including new test

- [ ] **Step 8: Commit**

```bash
git add src/api/services/abstractions/FileConfigService.ts src/api/services/FileConfigService.ts src/api/services/AppLogService.ts src/api/routes/appSettings.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: add FileConfigService result types and readGlobalConfig stub"
```

---

### Task 2: Security settings Zod schema with registry validation

**Files:**

- Modify: `src/api/services/FileConfigService.ts`
- Test: `src/api/services/__tests__/FileConfigService.test.ts`

**Interfaces:**

- Consumes: `SECURITY_FIELD_REGISTRY` from `#shared/security/index.js`, `IFileSecuritySettings`
- Produces: validated `securitySettings` in parsed config

- [ ] **Step 1: Write failing test — valid security settings parsed**

```typescript
it("returns parsed config with securitySettings", async () => {
  const config = {
    securitySettings: {
      pnpm: {
        ignoreScripts: "true",
        strictSsl: "true"
      }
    }
  };
  await writeFile(join(tempDir, ".dependency-upgrader.json"), JSON.stringify(config), "utf-8");

  const result = await service.readConfig(tempDir);
  expect(result).toEqual(config);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: FAIL — Zod rejects `securitySettings` (not in schema)

- [ ] **Step 3: Write failing tests for validation rejections**

```typescript
it("throws on unknown package manager in securitySettings", async () => {
  await writeFile(
    join(tempDir, ".dependency-upgrader.json"),
    JSON.stringify({ securitySettings: { deno: { foo: "bar" } } }),
    "utf-8"
  );

  await expect(service.readConfig(tempDir)).rejects.toThrow();
});

it("throws on unknown field for known PM in securitySettings", async () => {
  await writeFile(
    join(tempDir, ".dependency-upgrader.json"),
    JSON.stringify({ securitySettings: { pnpm: { nonExistentField: "true" } } }),
    "utf-8"
  );

  await expect(service.readConfig(tempDir)).rejects.toThrow();
});

it("throws on invalid field value in securitySettings", async () => {
  await writeFile(
    join(tempDir, ".dependency-upgrader.json"),
    JSON.stringify({ securitySettings: { pnpm: { minimumReleaseAge: "abc" } } }),
    "utf-8"
  );

  await expect(service.readConfig(tempDir)).rejects.toThrow();
});
```

- [ ] **Step 4: Add security settings Zod schema**

In `src/api/services/FileConfigService.ts`, import `SECURITY_FIELD_REGISTRY` and `PackageManagerId`:

```typescript
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";
```

Build a dynamic Zod schema that validates PM keys, field names, and field values against the registry:

```typescript
const packageManagerIds: [string, ...string[]] = ["yarn", "npm", "pnpm", "bun"];

const fileSecuritySettingsSchema = z
  .record(z.enum(packageManagerIds), z.record(z.string(), z.string()))
  .optional()
  .superRefine((value, ctx) => {
    if (!value) {
      return;
    }
    for (const [pm, fields] of Object.entries(value)) {
      const registry = SECURITY_FIELD_REGISTRY[pm as PackageManagerId];
      if (!registry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown package manager: ${pm}`,
          path: [pm]
        });
        continue;
      }
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        const fieldDef = registry.find(f => f.fieldName === fieldName);
        if (!fieldDef) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown field "${fieldName}" for ${pm}`,
            path: [pm, fieldName]
          });
          continue;
        }
        const validation = fieldDef.expectedValueSchema.safeParse(fieldValue);
        if (!validation.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: validation.error.issues[0]?.message ?? `Invalid value for ${fieldName}`,
            path: [pm, fieldName]
          });
        }
      }
    }
  });
```

Add to `projectFileConfigSchema`:

```typescript
const projectFileConfigSchema = z.object({
  stepHooks: z.array(fileStepHookSchema).optional(),
  settings: fileSettingsSchema.optional(),
  securitySettings: fileSecuritySettingsSchema
});
```

- [ ] **Step 5: Update `toFileConfig` to handle `securitySettings`**

```typescript
function toFileConfig(parsed: z.infer<typeof projectFileConfigSchema>): IProjectFileConfig {
  const config: IProjectFileConfig = {};
  if (parsed.stepHooks !== undefined) {
    config.stepHooks = parsed.stepHooks;
  }
  if (parsed.settings !== undefined) {
    config.settings = toFileSettings(parsed.settings);
  }
  if (parsed.securitySettings !== undefined) {
    config.securitySettings = parsed.securitySettings;
  }
  return config;
}
```

- [ ] **Step 6: Write test for multiple PMs in securitySettings**

```typescript
it("parses securitySettings with multiple package managers", async () => {
  const config = {
    securitySettings: {
      pnpm: { ignoreScripts: "true" },
      yarn: { npmMinimalAgeGate: "3d" }
    }
  };
  await writeFile(join(tempDir, ".dependency-upgrader.json"), JSON.stringify(config), "utf-8");

  const result = await service.readConfig(tempDir);
  expect(result!.securitySettings).toEqual(config.securitySettings);
});
```

- [ ] **Step 7: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/api/services/FileConfigService.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: add security settings Zod schema with registry validation"
```

---

### Task 3: JsonFileTool DI integration and `readGlobalConfig()` implementation

**Files:**

- Modify: `src/api/feature.ts`, `src/api/services/FileConfigService.ts`
- Test: `src/api/services/__tests__/FileConfigService.test.ts`

**Interfaces:**

- Consumes: `JsonFileTool` and `JsonFileToolFeature` from `@webiny/stdlib/node`, `IFileConfigResult`
- Produces: working `readGlobalConfig()` with JsonFileTool, proper error result types

- [ ] **Step 1: Register JsonFileToolFeature in ApiFeature**

In `src/api/feature.ts`, add import and registration:

```typescript
import { JsonFileToolFeature } from "@webiny/stdlib/node";
```

Inside `register()`, before `container.register(FileConfigService)`:

```typescript
JsonFileToolFeature.register(container);
```

- [ ] **Step 2: Write failing test — readGlobalConfig returns error result on bad JSON**

```typescript
describe("readGlobalConfig", () => {
  it("returns error result on malformed JSON", async () => {
    await writeFile(join(process.cwd(), ".dependency-upgrader.json"), "not valid json{{{", "utf-8");

    try {
      const result = await service.readGlobalConfig();
      expect(result.config).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe("json");
    } finally {
      await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    }
  });

  it("returns error result on invalid schema", async () => {
    await writeFile(
      join(process.cwd(), ".dependency-upgrader.json"),
      JSON.stringify({ settings: { logLevel: "debug" } }),
      "utf-8"
    );

    try {
      const result = await service.readGlobalConfig();
      expect(result.config).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe("schema");
    } finally {
      await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    }
  });

  it("returns parsed config when file is valid", async () => {
    await writeFile(
      join(process.cwd(), ".dependency-upgrader.json"),
      JSON.stringify({ settings: { logLevel: "info" } }),
      "utf-8"
    );

    try {
      const result = await service.readGlobalConfig();
      expect(result.config).toBeDefined();
      expect(result.config!.settings!.logLevel).toBe("info");
      expect(result.error).toBeUndefined();
    } finally {
      await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    }
  });
});
```

- [ ] **Step 3: Refactor FileConfigService to use JsonFileTool**

In `src/api/services/FileConfigService.ts`:

1. Remove `import { readFile } from "fs/promises"` and `import { join } from "path"`
2. Add `import { join } from "path"` back (still needed for path construction)
3. Add `import { JsonFileTool } from "@webiny/stdlib/node"`
4. Remove the `isEnoent` helper function
5. Add `JsonFileTool` to constructor dependencies

```typescript
class FileConfigServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly jsonFileTool: JsonFileTool.Interface
    ) {}

    public async readConfig(projectPath: string): Promise<IProjectFileConfig | null> {
        const result = this.jsonFileTool.readJson<IProjectFileConfig>(
            join(projectPath, CONFIG_FILENAME),
            { schema: projectFileConfigSchema }
        );
        if (result === null) {
            return null;
        }
        return toFileConfig(result as z.infer<typeof projectFileConfigSchema>);
    }
```

Note: `readJson` is synchronous but the interface is async — keep `async` for interface compatibility.

- [ ] **Step 4: Implement `readGlobalConfig()` with error handling**

```typescript
public async readGlobalConfig(): Promise<IFileConfigResult> {
    try {
        const result = this.jsonFileTool.readJson(
            join(process.cwd(), CONFIG_FILENAME),
            { schema: projectFileConfigSchema }
        );
        if (result === null) {
            return { config: null };
        }
        return { config: toFileConfig(result as z.infer<typeof projectFileConfigSchema>) };
    } catch (error: unknown) {
        if (error instanceof SyntaxError) {
            return { config: null, error: { type: "json", message: error.message } };
        }
        if (error instanceof z.ZodError) {
            return {
                config: null,
                error: { type: "schema", message: error.issues[0]?.message ?? "Invalid config" }
            };
        }
        throw error;
    }
}
```

- [ ] **Step 5: Update `readGlobalSettings()` to delegate to `readGlobalConfig()`**

```typescript
public async readGlobalSettings(): Promise<IFileSettingsResult> {
    const result = await this.readGlobalConfig();
    if (result.error) {
        return { settings: null, error: result.error };
    }
    return { settings: result.config?.settings ?? null };
}
```

- [ ] **Step 6: Update implementation registration with new dependency**

```typescript
export const FileConfigService = Abstraction.createImplementation({
  implementation: FileConfigServiceImpl,
  dependencies: [JsonFileTool]
});
```

- [ ] **Step 7: Update test beforeEach to register JsonFileToolFeature**

In `src/api/services/__tests__/FileConfigService.test.ts`:

```typescript
import { JsonFileToolFeature } from "@webiny/stdlib/node";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-test-"));
  const container = createContainer();
  JsonFileToolFeature.register(container);
  container.register(FileConfigServiceRegistration).inSingletonScope();
  service = container.resolve(FileConfigService);
});
```

- [ ] **Step 8: Update existing `readGlobalSettings()` tests for new return type**

Tests that currently do `expect(result).toBeNull()` should become `expect(result.settings).toBeNull()`.
Tests that `expect(result).toEqual(config.settings)` should become `expect(result.settings).toEqual(config.settings)`.
Tests that `rejects.toThrow()` for readGlobalSettings should now check result.error instead.

- [ ] **Step 9: Run all tests**

Run: `yarn vitest run`
Expected: all pass

- [ ] **Step 10: Commit**

```bash
git add src/api/feature.ts src/api/services/FileConfigService.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: integrate JsonFileTool and implement readGlobalConfig with error results"
```

---

### Task 4: FileConfigService 10s TTL cache and AppLogService cleanup

**Files:**

- Modify: `src/api/services/FileConfigService.ts`, `src/api/services/AppLogService.ts`
- Test: `src/api/services/__tests__/FileConfigService.test.ts`, `src/api/services/__tests__/AppLogService.test.ts`

**Interfaces:**

- Consumes: `IFileConfigResult` from Task 1
- Produces: cached `readGlobalConfig()`, simplified `AppLogService.getLogLevel()`

- [ ] **Step 1: Write failing test — cache returns same result within TTL**

```typescript
it("returns cached result within TTL without re-reading file", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(configPath, JSON.stringify({ settings: { logLevel: "info" } }), "utf-8");

  try {
    const first = await service.readGlobalConfig();
    expect(first.config!.settings!.logLevel).toBe("info");

    // Change file contents — cache should return old value
    await writeFile(configPath, JSON.stringify({ settings: { logLevel: "error" } }), "utf-8");

    const second = await service.readGlobalConfig();
    expect(second.config!.settings!.logLevel).toBe("info");
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 2: Write failing test — cache expires after TTL**

This test needs time manipulation. Use `vi.useFakeTimers()`:

```typescript
it("re-reads file after cache TTL expires", async () => {
  vi.useFakeTimers();
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(configPath, JSON.stringify({ settings: { logLevel: "info" } }), "utf-8");

  try {
    const first = await service.readGlobalConfig();
    expect(first.config!.settings!.logLevel).toBe("info");

    await writeFile(configPath, JSON.stringify({ settings: { logLevel: "error" } }), "utf-8");

    vi.advanceTimersByTime(10_001);

    const second = await service.readGlobalConfig();
    expect(second.config!.settings!.logLevel).toBe("error");
  } finally {
    await rm(configPath, { force: true });
    vi.useRealTimers();
  }
});
```

- [ ] **Step 3: Write failing test — cache stores error results**

```typescript
it("caches error results within TTL", async () => {
  const configPath = join(process.cwd(), ".dependency-upgrader.json");
  await writeFile(configPath, "bad json{{{", "utf-8");

  try {
    const first = await service.readGlobalConfig();
    expect(first.error).toBeDefined();

    // Fix the file — cache should still return error
    await writeFile(configPath, JSON.stringify({ settings: { logLevel: "info" } }), "utf-8");

    const second = await service.readGlobalConfig();
    expect(second.error).toBeDefined();
  } finally {
    await rm(configPath, { force: true });
  }
});
```

- [ ] **Step 4: Add cache to `readGlobalConfig()`**

In `FileConfigServiceImpl`, add private cache fields:

```typescript
private cachedResult: IFileConfigResult | null = null;
private cachedAt = 0;
private static readonly CACHE_TTL_MS = 10_000;
```

Wrap `readGlobalConfig()` body with cache check:

```typescript
public async readGlobalConfig(): Promise<IFileConfigResult> {
    const now = Date.now();
    if (this.cachedResult !== null && now - this.cachedAt < FileConfigServiceImpl.CACHE_TTL_MS) {
        return this.cachedResult;
    }

    // ... existing try/catch logic ...

    this.cachedResult = result;
    this.cachedAt = now;
    return result;
}
```

Store result (success or error) before returning in both the success path and the catch branches.

- [ ] **Step 5: Run cache tests**

Run: `yarn vitest run src/api/services/__tests__/FileConfigService.test.ts`
Expected: all pass

- [ ] **Step 6: Remove AppLogService private cache**

In `src/api/services/AppLogService.ts`:

1. Remove `const CACHE_TTL_MS = 10_000;`
2. Remove private fields `cachedLevel` and `cachedAt`
3. Simplify `getLogLevel()`:

```typescript
private async getLogLevel(): Promise<string> {
    const fileSettingsResult = await this.fileConfigService.readGlobalSettings();
    if (fileSettingsResult.settings?.logLevel) {
        return fileSettingsResult.settings.logLevel;
    }

    const row = await this.databaseClient.db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "log_level"))
        .get();

    return row?.value ?? "warn";
}
```

- [ ] **Step 7: Run all tests**

Run: `yarn vitest run`
Expected: all pass — AppLogService tests should still pass since FileConfigService cache covers the same behavior

- [ ] **Step 8: Commit**

```bash
git add src/api/services/FileConfigService.ts src/api/services/AppLogService.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: add 10s TTL cache to FileConfigService, remove AppLogService private cache"
```
