# Restructure Batch 3: AppLog + ErrorReporter + PackageJson

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move AppLog, ErrorReporter, and PackageJson into their own PascalCase folders.

**Architecture:** Pure file-move refactor. No code logic changes.

**Tech Stack:** TypeScript, @webiny/di

## Global Constraints

- PascalCase singular folder names
- `index.ts` exports abstractions + feature only — never implementations
- `feature.ts` uses `createFeature()` for DI registration
- No code logic changes
- Run `yarn format:fix` after all moves
- **After moving each file**, grep within it for relative imports (`from "."`) and adjust depth. See spec "Critical: Internal Import Depth Adjustment" section
- **Import paths in tables are from ORIGINAL codebase state.** If prior batches have run, use grep to find current file locations

---

### Task 1: AppLog

**Files:**
- Move: `src/api/services/abstractions/AppLogService.ts` → `src/api/services/AppLog/abstractions/AppLogService.ts`
- Move: `src/api/services/AppLogService.ts` → `src/api/services/AppLog/AppLogService.ts`
- Move: `src/api/services/__tests__/AppLogService.test.ts` → `src/api/services/AppLog/__tests__/AppLogService.test.ts`
- Create: `src/api/services/AppLog/feature.ts`, `src/api/services/AppLog/index.ts`

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/AppLog/abstractions
mkdir -p src/api/services/AppLog/__tests__
mv src/api/services/abstractions/AppLogService.ts src/api/services/AppLog/abstractions/AppLogService.ts
mv src/api/services/AppLogService.ts src/api/services/AppLog/AppLogService.ts
mv src/api/services/__tests__/AppLogService.test.ts src/api/services/AppLog/__tests__/AppLogService.test.ts
```

- [ ] **Step 2: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { AppLogService } from "./AppLogService.js";

export const AppLogFeature = createFeature({
    name: "Api/AppLogFeature",
    register(container) {
        container.register(AppLogService).inSingletonScope();
    }
});
```

- [ ] **Step 3: Create index.ts**

```typescript
export { AppLogService } from "./abstractions/AppLogService.js";
export { AppLogFeature } from "./feature.js";
```

- [ ] **Step 4: Update imports**

Abstraction imports:

| File | Old | New |
|------|-----|-----|
| `src/api/services/ConsoleEmailService.ts:2` | `from "./abstractions/AppLogService.js"` | `from "./AppLog/index.js"` |
| `src/api/services/ErrorReporter.ts:2` | `from "./abstractions/AppLogService.js"` | `from "./AppLog/index.js"` |
| `src/api/services/__tests__/ConsoleEmailService.test.ts:5` | `from "../abstractions/AppLogService.js"` | `from "../AppLog/index.js"` |

Implementation imports (for DI registration in tests):

| File | Old | New |
|------|-----|-----|
| `src/api/services/__tests__/AppLogService.test.ts:11` | `from "../abstractions/AppLogService.js"` | `from "../abstractions/AppLogService.js"` → now at `from "../AppLog/abstractions/AppLogService.js"` — but test moved too, so from within `AppLog/__tests__/`: `from "../abstractions/AppLogService.js"` (unchanged) |
| `src/api/services/__tests__/AppLogService.test.ts:10` | `from "#api/services/FileConfigService.js"` | Keep as-is (FileConfig not moved yet) |
| `src/api/feature.ts:55` | `from "./services/AppLogService.js"` | `import { AppLogFeature } from "./services/AppLog/index.js"`, replace registration with `AppLogFeature.register(container)` |

- [ ] **Step 5: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move AppLogService into own service folder"
```

---

### Task 2: ErrorReporter

**Files:**
- Move: `src/api/services/abstractions/ErrorReporter.ts` → `src/api/services/ErrorReporter/abstractions/ErrorReporter.ts`
- Move: `src/api/services/ErrorReporter.ts` → `src/api/services/ErrorReporter/ErrorReporter.ts`
- Create: `src/api/services/ErrorReporter/feature.ts`, `src/api/services/ErrorReporter/index.ts`

**Note:** There is no `ErrorReporter.test.ts` — no test file to move.

Wait — check the codebase. Let me verify.

Actually, there IS no standalone ErrorReporter test in `__tests__/`. The ErrorReporter is tested indirectly through other service tests. No test file to move.

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/ErrorReporter/abstractions
mv src/api/services/abstractions/ErrorReporter.ts src/api/services/ErrorReporter/abstractions/ErrorReporter.ts
mv src/api/services/ErrorReporter.ts src/api/services/ErrorReporter/ErrorReporter.ts
```

- [ ] **Step 2: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { ErrorReporter } from "./ErrorReporter.js";

export const ErrorReporterFeature = createFeature({
    name: "Api/ErrorReporterFeature",
    register(container) {
        container.register(ErrorReporter).inSingletonScope();
    }
});
```

- [ ] **Step 3: Create index.ts**

```typescript
export { ErrorReporter } from "./abstractions/ErrorReporter.js";
export { ErrorReporterFeature } from "./feature.js";
```

- [ ] **Step 4: Update imports**

| File | Old | New |
|------|-----|-----|
| `src/api/routes/__tests__/jobs.test.ts:43` | `from "../../services/abstractions/ErrorReporter.js"` | `from "../../services/ErrorReporter/index.js"` |
| `src/api/routes/__tests__/projects.test.ts:62` | `from "../../services/abstractions/ErrorReporter.js"` | `from "../../services/ErrorReporter/index.js"` |
| `src/api/routes/__tests__/upgradeSessions.test.ts:15` | `from "#api/services/abstractions/ErrorReporter.js"` | `from "#api/services/ErrorReporter/index.js"` |
| `src/api/routes/__tests__/packageManager.test.ts:64` | `from "../../services/abstractions/ErrorReporter.js"` | `from "../../services/ErrorReporter/index.js"` |
| `src/api/services/JobWorker.ts:10` | `from "./abstractions/ErrorReporter.js"` | `from "./ErrorReporter/index.js"` |
| `src/api/services/UpgradeSessionService.ts:13` | `from "./abstractions/ErrorReporter.js"` | `from "./ErrorReporter/index.js"` |
| `src/api/services/jobExecutors/PackageScanJobExecutor.ts:13` | `from "../abstractions/ErrorReporter.js"` | `from "../ErrorReporter/index.js"` |
| `src/api/services/jobExecutors/__tests__/PackageScanJobExecutor.test.ts:10` | `from "../../abstractions/ErrorReporter.js"` | `from "../../ErrorReporter/index.js"` |
| `src/api/services/__tests__/JobWorker.test.ts:38` | `from "../abstractions/ErrorReporter.js"` | `from "../ErrorReporter/index.js"` |
| `src/api/services/__tests__/UpgradeSessionService.test.ts:9` | `from "../abstractions/ErrorReporter.js"` | `from "../ErrorReporter/index.js"` |
| `src/api/feature.ts:56` | `from "./services/ErrorReporter.js"` | `import { ErrorReporterFeature } from "./services/ErrorReporter/index.js"`, replace registration |

- [ ] **Step 5: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move ErrorReporter into own service folder"
```

---

### Task 3: PackageJson

**Files:**
- Move: `src/api/services/abstractions/PackageJsonService.ts` → `src/api/services/PackageJson/abstractions/PackageJsonService.ts`
- Move: `src/api/services/PackageJsonService.ts` → `src/api/services/PackageJson/PackageJsonService.ts`
- Move: `src/api/services/__tests__/PackageJsonService.test.ts` → `src/api/services/PackageJson/__tests__/PackageJsonService.test.ts`
- Create: `src/api/services/PackageJson/feature.ts`, `src/api/services/PackageJson/index.ts`

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/PackageJson/abstractions
mkdir -p src/api/services/PackageJson/__tests__
mv src/api/services/abstractions/PackageJsonService.ts src/api/services/PackageJson/abstractions/PackageJsonService.ts
mv src/api/services/PackageJsonService.ts src/api/services/PackageJson/PackageJsonService.ts
mv src/api/services/__tests__/PackageJsonService.test.ts src/api/services/PackageJson/__tests__/PackageJsonService.test.ts
```

- [ ] **Step 2: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { PackageJsonService } from "./PackageJsonService.js";

export const PackageJsonFeature = createFeature({
    name: "Api/PackageJsonFeature",
    register(container) {
        container.register(PackageJsonService).inSingletonScope();
    }
});
```

- [ ] **Step 3: Create index.ts**

```typescript
export { PackageJsonService } from "./abstractions/PackageJsonService.js";
export { PackageJsonFeature } from "./feature.js";
```

- [ ] **Step 4: Update imports**

| File | Old | New |
|------|-----|-----|
| `src/api/routes/stepHooks.ts:15` | `from "#api/services/abstractions/PackageJsonService.js"` | `from "#api/services/PackageJson/index.js"` |
| `src/api/routes/__tests__/stepHooks.test.ts:19` | `from "../../services/PackageJsonService.js"` | `from "../../services/PackageJson/PackageJsonService.js"` |
| `src/api/feature.ts:61` | `from "./services/PackageJsonService.js"` | `import { PackageJsonFeature } from "./services/PackageJson/index.js"`, replace registration |

- [ ] **Step 5: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move PackageJsonService into own service folder"
```
