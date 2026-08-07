# Restructure Batch 4: FileConfig + Security + StepHook

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move FileConfig, Security, and StepHook services into their own PascalCase folders.

**Architecture:** Pure file-move refactor. No code logic changes.

**Tech Stack:** TypeScript, @webiny/di

## Global Constraints

- PascalCase singular folder names
- `index.ts` exports abstractions + feature only — never implementations
- No code logic changes
- Run `yarn format:fix` after moves
- Commit after each service move
- **After moving each file**, grep within it for relative imports (`from "."`) and adjust depth. See spec "Critical: Internal Import Depth Adjustment" section
- **Import paths in tables are from ORIGINAL codebase state.** If prior batches have run, use grep to find current file locations

---

### Task 1: FileConfig

**Files:**
- Move: `src/api/services/abstractions/FileConfigService.ts` → `src/api/services/FileConfig/abstractions/FileConfigService.ts`
- Move: `src/api/services/FileConfigService.ts` → `src/api/services/FileConfig/FileConfigService.ts`
- Move: `src/api/services/__tests__/FileConfigService.test.ts` → `src/api/services/FileConfig/__tests__/FileConfigService.test.ts`
- Create: `feature.ts`, `index.ts`

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/FileConfig/abstractions
mkdir -p src/api/services/FileConfig/__tests__
mv src/api/services/abstractions/FileConfigService.ts src/api/services/FileConfig/abstractions/FileConfigService.ts
mv src/api/services/FileConfigService.ts src/api/services/FileConfig/FileConfigService.ts
mv src/api/services/__tests__/FileConfigService.test.ts src/api/services/FileConfig/__tests__/FileConfigService.test.ts
```

- [ ] **Step 2: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { FileConfigService } from "./FileConfigService.js";

export const FileConfigFeature = createFeature({
    name: "Api/FileConfigFeature",
    register(container) {
        container.register(FileConfigService).inSingletonScope();
    }
});
```

- [ ] **Step 3: Create index.ts**

```typescript
export { FileConfigService } from "./abstractions/FileConfigService.js";
export { FileConfigFeature } from "./feature.js";
```

Note: Also re-export any types that consumers import from the abstraction file. Check `FileConfigService.ts` abstraction for exported types like `IFileConfigService`, `IFileConfigResult`, etc.

- [ ] **Step 4: Update abstraction imports**

| File | Old | New |
|------|-----|-----|
| `src/api/routes/appSettings.ts:8` | `from "#api/services/abstractions/FileConfigService.js"` | `from "#api/services/FileConfig/index.js"` |
| `src/api/routes/settings.ts:20` | `from "#api/services/abstractions/FileConfigService.js"` | `from "#api/services/FileConfig/index.js"` |
| `src/api/routes/stepHooks.ts:14` | `from "#api/services/abstractions/FileConfigService.js"` | `from "#api/services/FileConfig/index.js"` |
| `src/api/routes/__tests__/cache.test.ts:11` | `from "../../services/abstractions/FileConfigService.js"` | `from "../../services/FileConfig/index.js"` |
| `src/api/routes/__tests__/changelogs.test.ts:13` | `from "../../services/abstractions/FileConfigService.js"` | `from "../../services/FileConfig/index.js"` |
| `src/api/services/AppLogService.ts:6` | `from "./abstractions/FileConfigService.js"` | `from "./FileConfig/index.js"` |
| `src/api/services/UpgradeService.ts:4` | `from "./abstractions/FileConfigService.js"` | `from "./FileConfig/index.js"` |
| `src/api/services/StepHookService.ts:5` | `from "./abstractions/FileConfigService.js"` | `from "./FileConfig/index.js"` |
| `src/api/services/RegistryCacheService.ts:7` | `from "./abstractions/FileConfigService.js"` | `from "./FileConfig/index.js"` |
| `src/api/services/jobExecutors/InstallJobExecutor.ts:7` | `from "../abstractions/FileConfigService.js"` | `from "../FileConfig/index.js"` |
| `src/api/services/jobExecutors/__tests__/PackageScanJobExecutor.test.ts:12` | `from "../../abstractions/FileConfigService.js"` | `from "../../FileConfig/index.js"` |
| `src/api/services/__tests__/UpgradeService.test.ts:4` | `from "../abstractions/FileConfigService.js"` | `from "../FileConfig/index.js"` |
| `src/api/services/__tests__/ChangelogService.test.ts:9` | `from "../abstractions/FileConfigService.js"` | `from "../FileConfig/index.js"` |

Implementation imports (for DI in tests):

| File | Old | New |
|------|-----|-----|
| `src/api/routes/__tests__/stepHooks.test.ts:18` | `from "../../services/FileConfigService.js"` | `from "../../services/FileConfig/FileConfigService.js"` |
| `src/api/routes/__tests__/settings.test.ts:15` | `from "#api/services/FileConfigService.js"` | `from "#api/services/FileConfig/FileConfigService.js"` |
| `src/api/routes/__tests__/jobs.test.ts:42` | `from "../../services/FileConfigService.js"` | `from "../../services/FileConfig/FileConfigService.js"` |
| `src/api/routes/__tests__/projects.test.ts:40` | `from "../../services/FileConfigService.js"` | `from "../../services/FileConfig/FileConfigService.js"` |
| `src/api/routes/__tests__/appSettings.test.ts:13` | `from "#api/services/FileConfigService.js"` | `from "#api/services/FileConfig/FileConfigService.js"` |
| `src/api/routes/__tests__/packageManager.test.ts:42` | `from "../../services/FileConfigService.js"` | `from "../../services/FileConfig/FileConfigService.js"` |
| `src/api/services/__tests__/AppLogService.test.ts:10` | `from "#api/services/FileConfigService.js"` | `from "#api/services/FileConfig/FileConfigService.js"` |
| `src/api/feature.ts:60` | `from "./services/FileConfigService.js"` | `import { FileConfigFeature } from "./services/FileConfig/index.js"`, replace registration |

- [ ] **Step 5: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move FileConfigService into own service folder"
```

---

### Task 2: Security

**Files:**
- Move: `src/api/services/abstractions/SecurityService.ts` → `src/api/services/Security/abstractions/SecurityService.ts`
- Move: `src/api/services/SecurityService.ts` → `src/api/services/Security/SecurityService.ts`
- Move: `src/api/services/__tests__/SecurityService.test.ts` → `src/api/services/Security/__tests__/SecurityService.test.ts`
- Create: `feature.ts`, `index.ts`

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/Security/abstractions
mkdir -p src/api/services/Security/__tests__
mv src/api/services/abstractions/SecurityService.ts src/api/services/Security/abstractions/SecurityService.ts
mv src/api/services/SecurityService.ts src/api/services/Security/SecurityService.ts
mv src/api/services/__tests__/SecurityService.test.ts src/api/services/Security/__tests__/SecurityService.test.ts
```

- [ ] **Step 2: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { SecurityService } from "./SecurityService.js";

export const SecurityFeature = createFeature({
    name: "Api/SecurityFeature",
    register(container) {
        container.register(SecurityService).inSingletonScope();
    }
});
```

- [ ] **Step 3: Create index.ts**

```typescript
export { SecurityService } from "./abstractions/SecurityService.js";
export { SecurityFeature } from "./feature.js";
```

- [ ] **Step 4: Update imports**

| File | Old | New |
|------|-----|-----|
| `src/api/routes/projects.ts:26` | `from "../services/abstractions/SecurityService.js"` | `from "../services/Security/index.js"` |
| `src/api/services/JobWorker.ts:5` | `from "./abstractions/SecurityService.js"` | `from "./Security/index.js"` |
| `src/api/services/jobExecutors/CloneJobExecutor.ts:7` | `from "../abstractions/SecurityService.js"` | `from "../Security/index.js"` |
| `src/api/services/jobExecutors/PackageScanJobExecutor.ts:10` | `from "../abstractions/SecurityService.js"` | `from "../Security/index.js"` |
| `src/api/routes/__tests__/projects.test.ts:21` | `from "../../services/SecurityService.js"` | `from "../../services/Security/SecurityService.js"` |
| `src/api/routes/__tests__/jobs.test.ts:23` | `from "../../services/SecurityService.js"` | `from "../../services/Security/SecurityService.js"` |
| `src/api/routes/__tests__/packageManager.test.ts:23` | `from "../../services/SecurityService.js"` | `from "../../services/Security/SecurityService.js"` |
| `src/api/feature.ts:11` | `from "./services/SecurityService.js"` | `import { SecurityFeature } from "./services/Security/index.js"`, replace registration |

- [ ] **Step 5: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move SecurityService into own service folder"
```

---

### Task 3: StepHook

**Files:**
- Move: `src/api/services/abstractions/StepHookService.ts` → `src/api/services/StepHook/abstractions/StepHookService.ts`
- Move: `src/api/services/StepHookService.ts` → `src/api/services/StepHook/StepHookService.ts`
- Move: `src/api/services/__tests__/StepHookService.test.ts` → `src/api/services/StepHook/__tests__/StepHookService.test.ts`
- Create: `feature.ts`, `index.ts`

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/StepHook/abstractions
mkdir -p src/api/services/StepHook/__tests__
mv src/api/services/abstractions/StepHookService.ts src/api/services/StepHook/abstractions/StepHookService.ts
mv src/api/services/StepHookService.ts src/api/services/StepHook/StepHookService.ts
mv src/api/services/__tests__/StepHookService.test.ts src/api/services/StepHook/__tests__/StepHookService.test.ts
```

- [ ] **Step 2: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { StepHookService } from "./StepHookService.js";

export const StepHookFeature = createFeature({
    name: "Api/StepHookFeature",
    register(container) {
        container.register(StepHookService).inSingletonScope();
    }
});
```

- [ ] **Step 3: Create index.ts**

```typescript
export { StepHookService } from "./abstractions/StepHookService.js";
export { StepHookFeature } from "./feature.js";
```

- [ ] **Step 4: Update imports**

| File | Old | New |
|------|-----|-----|
| `src/api/routes/__tests__/upgradeSessions.test.ts:24` | `from "#api/services/abstractions/StepHookService.js"` | `from "#api/services/StepHook/index.js"` |
| `src/api/services/UpgradeSessionService.ts:14` | `from "./abstractions/StepHookService.js"` | `from "./StepHook/index.js"` |
| `src/api/services/__tests__/UpgradeSessionService.test.ts:16` | `from "../abstractions/StepHookService.js"` | `from "../StepHook/index.js"` |
| `src/api/services/stepResolvers/__tests__/stepPipeline.test.ts:3` | `from "../../abstractions/StepHookService.js"` | `from "../../StepHook/index.js"` |
| `src/api/services/stepResolvers/stepPipeline.ts:3` | `from "../abstractions/StepHookService.js"` | `from "../StepHook/index.js"` |
| `src/api/feature.ts:59` | `from "./services/StepHookService.js"` | `import { StepHookFeature } from "./services/StepHook/index.js"`, replace registration |

- [ ] **Step 5: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move StepHookService into own service folder"
```
