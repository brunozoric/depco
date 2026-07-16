# File Config Extension — Part 1: ENOENT Narrowing + Schema Extension

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow FileConfigService catch-all to ENOENT-only, extend schema with optional `settings` section, add `readGlobalSettings()` method.

**Architecture:** FileConfigService gains a `readGlobalSettings()` method that reads `CWD/.dependency-upgrader.json` and returns its `settings` section. Both `stepHooks` and `settings` become optional in the Zod schema. ENOENT returns `null`; all other filesystem/parse/validation errors throw.

**Tech Stack:** TypeScript, Zod, Node.js fs/promises, Vitest

## Global Constraints

- Yarn 4 package manager
- oxlint (not ESLint), oxfmt (not Prettier)
- Named interfaces only (no inline structural types)
- DI abstractions in `abstractions/` directory, one file per token
- Work directly on main, no feature branches, no worktrees

---

### Task 1: Narrow ENOENT catch and extend schema + abstraction

**Files:**

- Modify: `src/api/services/abstractions/FileConfigService.ts:1-25`
- Modify: `src/api/services/FileConfigService.ts:1-38`
- Modify: `src/api/services/StepHookService.ts:18-29`
- Test: `src/api/services/__tests__/FileConfigService.test.ts`

**Interfaces:**

- Consumes: nothing new
- Produces: `IFileSettings { branchTemplate?: string; commitTemplate?: string; logLevel?: "error" | "warn" | "info" }`, `IProjectFileConfig.stepHooks` becomes optional, `IProjectFileConfig.settings?: IFileSettings`, `readGlobalSettings(): Promise<IFileSettings | null>`

- [ ] **Step 1: Write failing tests for ENOENT narrowing**

Add to `src/api/services/__tests__/FileConfigService.test.ts`:

```typescript
it("throws on non-ENOENT filesystem error (e.g., reading a directory)", async () => {
  await expect(service.readConfig("/")).rejects.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/api/services/__tests__/FileConfigService.test.ts`
Expected: FAIL — current catch-all returns `null` for all errors including EISDIR.

- [ ] **Step 3: Write failing tests for readGlobalSettings**

Add to `src/api/services/__tests__/FileConfigService.test.ts`:

```typescript
describe("readGlobalSettings", () => {
  it("returns null when no file exists", async () => {
    const result = await service.readGlobalSettings();
    expect(result).toBeNull();
  });

  it("returns parsed settings when file has settings key", async () => {
    const config = {
      settings: {
        branchTemplate: "chore/deps-${YYYY}",
        commitTemplate: "chore: deps",
        logLevel: "info" as const
      }
    };
    await writeFile(
      join(process.cwd(), ".dependency-upgrader.json"),
      JSON.stringify(config),
      "utf-8"
    );

    try {
      const result = await service.readGlobalSettings();
      expect(result).toEqual(config.settings);
    } finally {
      await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    }
  });

  it("returns null when file exists but has no settings key", async () => {
    const config = {
      stepHooks: [
        {
          position: "pre:upgrade",
          name: "Lint",
          command: "yarn lint",
          executionType: "command",
          required: true
        }
      ]
    };
    await writeFile(
      join(process.cwd(), ".dependency-upgrader.json"),
      JSON.stringify(config),
      "utf-8"
    );

    try {
      const result = await service.readGlobalSettings();
      expect(result).toBeNull();
    } finally {
      await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    }
  });

  it("throws on malformed JSON", async () => {
    await writeFile(join(process.cwd(), ".dependency-upgrader.json"), "not valid json{{{", "utf-8");

    try {
      await expect(service.readGlobalSettings()).rejects.toThrow();
    } finally {
      await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    }
  });

  it("throws on invalid logLevel value", async () => {
    await writeFile(
      join(process.cwd(), ".dependency-upgrader.json"),
      JSON.stringify({ settings: { logLevel: "debug" } }),
      "utf-8"
    );

    try {
      await expect(service.readGlobalSettings()).rejects.toThrow();
    } finally {
      await rm(join(process.cwd(), ".dependency-upgrader.json"), { force: true });
    }
  });

  it("throws on non-ENOENT filesystem error", async () => {
    const originalCwd = process.cwd;
    process.cwd = () => "/nonexistent-dir-that-causes-eacces";
    try {
      await expect(service.readGlobalSettings()).rejects.toThrow();
    } finally {
      process.cwd = originalCwd;
    }
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/FileConfigService.test.ts`
Expected: FAIL — `readGlobalSettings` does not exist yet, and ENOENT narrowing not implemented.

- [ ] **Step 5: Update abstraction — add IFileSettings and readGlobalSettings**

In `src/api/services/abstractions/FileConfigService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IFileStepHook {
  position: string;
  name: string;
  command: string;
  executionType: "command" | "script" | "package-script";
  required: boolean;
}

export interface IFileSettings {
  branchTemplate?: string;
  commitTemplate?: string;
  logLevel?: "error" | "warn" | "info";
}

export interface IProjectFileConfig {
  stepHooks?: IFileStepHook[];
  settings?: IFileSettings;
}

export interface IFileConfigService {
  readConfig(projectPath: string): Promise<IProjectFileConfig | null>;
  readGlobalSettings(): Promise<IFileSettings | null>;
}

export const FileConfigService = createAbstraction<IFileConfigService>("Api/FileConfigService");

export namespace FileConfigService {
  export type Interface = IFileConfigService;
  export type FileConfig = IProjectFileConfig;
  export type StepHook = IFileStepHook;
  export type Settings = IFileSettings;
}
```

- [ ] **Step 6: Update implementation — ENOENT narrowing, schema extension, readGlobalSettings**

In `src/api/services/FileConfigService.ts`:

```typescript
import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { FileConfigService as Abstraction } from "./abstractions/FileConfigService.js";
import type { IProjectFileConfig, IFileSettings } from "./abstractions/FileConfigService.js";

const CONFIG_FILENAME = ".dependency-upgrader.json";

const fileStepHookSchema = z.object({
  position: z.string(),
  name: z.string(),
  command: z.string(),
  executionType: z.enum(["command", "script", "package-script"]),
  required: z.boolean()
});

const fileSettingsSchema = z.object({
  branchTemplate: z.string().optional(),
  commitTemplate: z.string().optional(),
  logLevel: z.enum(["error", "warn", "info"]).optional()
});

const projectFileConfigSchema = z.object({
  stepHooks: z.array(fileStepHookSchema).optional(),
  settings: fileSettingsSchema.optional()
});

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

class FileConfigServiceImpl implements Abstraction.Interface {
  public async readConfig(projectPath: string): Promise<IProjectFileConfig | null> {
    let raw: string;
    try {
      raw = await readFile(join(projectPath, CONFIG_FILENAME), "utf-8");
    } catch (error: unknown) {
      if (isEnoent(error)) {
        return null;
      }
      throw error;
    }

    const parsed: unknown = JSON.parse(raw);
    return projectFileConfigSchema.parse(parsed);
  }

  public async readGlobalSettings(): Promise<IFileSettings | null> {
    let raw: string;
    try {
      raw = await readFile(join(process.cwd(), CONFIG_FILENAME), "utf-8");
    } catch (error: unknown) {
      if (isEnoent(error)) {
        return null;
      }
      throw error;
    }

    const parsed: unknown = JSON.parse(raw);
    const config = projectFileConfigSchema.parse(parsed);
    return config.settings ?? null;
  }
}

export const FileConfigService = Abstraction.createImplementation({
  implementation: FileConfigServiceImpl,
  dependencies: []
});
```

- [ ] **Step 7: Fix StepHookService for optional stepHooks**

In `src/api/services/StepHookService.ts`, change the `getStepConfig` method:

```typescript
public async getStepConfig(
    projectId: string,
    projectPath: string
): Promise<IResolvedStepHook[]> {
    const fileConfig = await this.fileConfigService.readConfig(projectPath);

    if (fileConfig?.stepHooks) {
        return fileConfig.stepHooks.map(hook => ({
            position: hook.position,
            name: hook.name,
            command: hook.command,
            executionType: hook.executionType,
            required: hook.required,
            source: "file" as const
        }));
    }

    const rows = await this.databaseClient.db
        .select()
        .from(projectStepHooks)
        .where(and(eq(projectStepHooks.projectId, projectId), eq(projectStepHooks.enabled, 1)))
        .orderBy(asc(projectStepHooks.position), asc(projectStepHooks.sortOrder))
        .all();

    return rows.map(row => ({
        position: row.position,
        name: row.name,
        command: row.command,
        executionType: row.type as IResolvedStepHook["executionType"],
        required: row.required === 1,
        source: row.source as IResolvedStepHook["source"]
    }));
}
```

- [ ] **Step 8: Run all tests**

Run: `yarn test`
Expected: All pass including new ENOENT and readGlobalSettings tests.

- [ ] **Step 9: Run full pipeline**

Run: `yarn full`
Expected: adio + lint + format + build + test all pass.

- [ ] **Step 10: Commit**

```bash
git add src/api/services/abstractions/FileConfigService.ts src/api/services/FileConfigService.ts src/api/services/StepHookService.ts src/api/services/__tests__/FileConfigService.test.ts
git commit -m "feat: narrow ENOENT catch, extend file config schema with settings, add readGlobalSettings"
```
