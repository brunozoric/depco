# Restructure Batch 1: EventBus + Encryption

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move EventBus and Encryption services into their own PascalCase folders with abstractions, feature.ts, and index.ts.

**Architecture:** Pure file-move refactor. Create folder, move files, create feature.ts + index.ts, update all import paths. No code logic changes.

**Tech Stack:** TypeScript, @webiny/di (createAbstraction, createImplementation, createFeature)

## Global Constraints

- PascalCase singular folder names
- `index.ts` exports abstractions + feature only — never implementations
- `feature.ts` uses `createFeature()` for DI registration
- No code logic changes — only file moves and import path updates
- Run `yarn format:fix` after all moves
- **After moving each file**, grep within it for relative imports (`from "."`) and adjust depth. See spec "Critical: Internal Import Depth Adjustment" section
- **Import paths in tables are from ORIGINAL codebase state.** If prior batches have run, use grep to find current file locations

---

### Task 1: EventBus — Create Folder and Move Files

**Files:**
- Create: `src/api/services/EventBus/` directory
- Create: `src/api/services/EventBus/abstractions/` directory
- Create: `src/api/services/EventBus/__tests__/` directory
- Move: `src/api/services/abstractions/EventBus.ts` → `src/api/services/EventBus/abstractions/EventBus.ts`
- Move: `src/api/services/EventBus.ts` → `src/api/services/EventBus/EventBus.ts`
- Move: `src/api/services/__tests__/ScanSchedulerService.test.ts` — NOT moved here (belongs to ScanScheduler)

**Interfaces:**
- Produces: `src/api/services/EventBus/index.ts` (exports EventBus abstraction + EventBusFeature)

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/api/services/EventBus/abstractions
mkdir -p src/api/services/EventBus/__tests__
```

- [ ] **Step 2: Move abstraction file**

```bash
mv src/api/services/abstractions/EventBus.ts src/api/services/EventBus/abstractions/EventBus.ts
```

- [ ] **Step 3: Move implementation file**

```bash
mv src/api/services/EventBus.ts src/api/services/EventBus/EventBus.ts
```

- [ ] **Step 4: Update implementation import of its own abstraction**

In `src/api/services/EventBus/EventBus.ts`, update:
```typescript
// OLD
import { EventBus as Abstraction } from "./abstractions/EventBus.js";
import type { EventName, IEventMap } from "./abstractions/EventBus.js";
```
No change needed — relative path still valid since both moved together.

- [ ] **Step 5: Create feature.ts**

Create `src/api/services/EventBus/feature.ts`:
```typescript
import { createFeature } from "#shared/index.js";
import { EventBus } from "./EventBus.js";

export const EventBusFeature = createFeature({
    name: "Api/EventBusFeature",
    register(container) {
        container.register(EventBus).inSingletonScope();
    }
});
```

- [ ] **Step 6: Create index.ts**

Create `src/api/services/EventBus/index.ts`:
```typescript
export { EventBus } from "./abstractions/EventBus.js";
export type { IEventBus, IEventMap, EventName } from "./abstractions/EventBus.js";
export { EventBusFeature } from "./feature.js";
```

- [ ] **Step 7: Update all import paths**

Files importing the EventBus **abstraction** (old path → new path):

| File | Old Import | New Import |
|------|-----------|------------|
| `src/api/server.ts:16` | `from "./services/abstractions/EventBus.js"` | `from "./services/EventBus/index.js"` |
| `src/api/services/ScanSchedulerService.ts:6` | `from "./abstractions/EventBus.js"` | `from "./EventBus/index.js"` |
| `src/api/services/jobExecutors/LicenseScanJobExecutor.ts:9` | `from "../abstractions/EventBus.js"` | `from "../EventBus/index.js"` |
| `src/api/services/jobExecutors/ScanJobExecutor.ts:10` | `from "../abstractions/EventBus.js"` | `from "../EventBus/index.js"` |
| `src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts:12` | `from "../../abstractions/EventBus.js"` | `from "../../EventBus/index.js"` |
| `src/api/services/jobExecutors/__tests__/ScanJobExecutor.test.ts:9` | `from "../../abstractions/EventBus.js"` | `from "../../EventBus/index.js"` |
| `src/api/services/__tests__/ScanSchedulerService.test.ts:8` | `from "../abstractions/EventBus.js"` | `from "../EventBus/index.js"` |

Files importing the EventBus **implementation** (for DI registration in tests):

| File | Old Import | New Import |
|------|-----------|------------|
| `src/api/feature.ts:58` | `from "./services/EventBus.js"` | `from "./services/EventBus/index.js"` — change to import `EventBusFeature` |
| `src/api/routes/__tests__/jobs.test.ts:45` | `from "../../services/EventBus.js"` | `from "../../services/EventBus/EventBus.js"` |
| `src/api/routes/__tests__/projects.test.ts:64` | `from "../../services/EventBus.js"` | `from "../../services/EventBus/EventBus.js"` |
| `src/api/routes/__tests__/packageManager.test.ts:66` | `from "../../services/EventBus.js"` | `from "../../services/EventBus/EventBus.js"` |
| `src/api/services/__tests__/JobWorker.test.ts:40` | `from "../../services/EventBus.js"` | `from "../EventBus/EventBus.js"` |

**Note on feature.ts:** For now, update the import path only. The full feature.ts rewrite (composing sub-features) happens in the cleanup batch. Change the import to `EventBusFeature` from `./services/EventBus/index.js` and replace the `container.register(EventBus).inSingletonScope()` line with `EventBusFeature.register(container)`.

- [ ] **Step 8: Verify**

```bash
yarn format:fix
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move EventBus into own service folder"
```

---

### Task 2: Encryption — Create Folder and Move Files

**Files:**
- Create: `src/api/services/Encryption/` directory
- Create: `src/api/services/Encryption/abstractions/` directory
- Create: `src/api/services/Encryption/__tests__/` directory
- Move: `src/api/services/abstractions/EncryptionService.ts` → `src/api/services/Encryption/abstractions/EncryptionService.ts`
- Move: `src/api/services/EncryptionService.ts` → `src/api/services/Encryption/EncryptionService.ts`

**Interfaces:**
- Produces: `src/api/services/Encryption/index.ts` (exports EncryptionService abstraction + EncryptionFeature)

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/api/services/Encryption/abstractions
mkdir -p src/api/services/Encryption/__tests__
```

- [ ] **Step 2: Move files**

```bash
mv src/api/services/abstractions/EncryptionService.ts src/api/services/Encryption/abstractions/EncryptionService.ts
mv src/api/services/EncryptionService.ts src/api/services/Encryption/EncryptionService.ts
```

- [ ] **Step 3: Update implementation import of its own abstraction**

In `src/api/services/Encryption/EncryptionService.ts`, update:
```typescript
// OLD
import { EncryptionService as Abstraction } from "./abstractions/EncryptionService.js";
```
No change needed — relative path still valid.

- [ ] **Step 4: Create feature.ts**

Create `src/api/services/Encryption/feature.ts`:
```typescript
import { createFeature } from "#shared/index.js";
import { EncryptionService } from "./EncryptionService.js";

export const EncryptionFeature = createFeature({
    name: "Api/EncryptionFeature",
    register(container) {
        container.register(EncryptionService).inSingletonScope();
    }
});
```

- [ ] **Step 5: Create index.ts**

Create `src/api/services/Encryption/index.ts`:
```typescript
export { EncryptionService } from "./abstractions/EncryptionService.js";
export { EncryptionFeature } from "./feature.js";
```

- [ ] **Step 6: Update all import paths**

| File | Old Import | New Import |
|------|-----------|------------|
| `src/api/routes/appSettings.ts:7` | `from "#api/services/abstractions/EncryptionService.js"` | `from "#api/services/Encryption/index.js"` |
| `src/api/services/ForgeService.ts:7` | `from "./abstractions/EncryptionService.js"` | `from "./Encryption/index.js"` |
| `src/testing/helpers/registerEncryption.ts:3` | `from "#api/services/EncryptionService.js"` | `from "#api/services/Encryption/EncryptionService.js"` |
| `src/api/feature.ts:68` | `from "./services/EncryptionService.js"` | Update to `EncryptionFeature` from `./services/Encryption/index.js`, replace `container.register(EncryptionService).inSingletonScope()` with `EncryptionFeature.register(container)` |

- [ ] **Step 7: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move EncryptionService into own service folder"
```
