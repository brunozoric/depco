# Restructure Batch 2: CommandRunner + Email

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move CommandRunner and Email (ConsoleEmailService) into their own PascalCase folders.

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

### Task 1: CommandRunner

**Files:**

- Move: `src/api/services/abstractions/CommandRunner.ts` → `src/api/services/CommandRunner/abstractions/CommandRunner.ts`
- Move: `src/api/services/CommandRunner.ts` → `src/api/services/CommandRunner/CommandRunner.ts`
- Move: `src/api/services/__tests__/CommandRunner.test.ts` → `src/api/services/CommandRunner/__tests__/CommandRunner.test.ts`
- Create: `src/api/services/CommandRunner/feature.ts`
- Create: `src/api/services/CommandRunner/index.ts`

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/CommandRunner/abstractions
mkdir -p src/api/services/CommandRunner/__tests__
mv src/api/services/abstractions/CommandRunner.ts src/api/services/CommandRunner/abstractions/CommandRunner.ts
mv src/api/services/CommandRunner.ts src/api/services/CommandRunner/CommandRunner.ts
mv src/api/services/__tests__/CommandRunner.test.ts src/api/services/CommandRunner/__tests__/CommandRunner.test.ts
```

- [ ] **Step 2: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { CommandRunner } from "./CommandRunner.js";

export const CommandRunnerFeature = createFeature({
  name: "Api/CommandRunnerFeature",
  register(container) {
    container.register(CommandRunner).inSingletonScope();
  }
});
```

- [ ] **Step 3: Create index.ts**

```typescript
export { CommandRunner } from "./abstractions/CommandRunner.js";
export type {
  ICommandRunner,
  ICommandRunnerResult,
  ICommandRunnerRunOptions,
  ICommandRunnerStreamOptions
} from "./abstractions/CommandRunner.js";
export { CommandRunnerFeature } from "./feature.js";
```

- [ ] **Step 4: Update abstraction imports**

These files import `CommandRunner` from the old shared `abstractions/` directory:

| File                                                                             | Old Import                                            | New Import                                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| `src/api/routes/__tests__/jobs.test.ts:22`                                       | `from "../../services/abstractions/CommandRunner.js"` | `from "../../services/CommandRunner/index.js"` |
| `src/api/routes/__tests__/cache.test.ts:10`                                      | `from "../../services/abstractions/CommandRunner.js"` | `from "../../services/CommandRunner/index.js"` |
| `src/api/routes/__tests__/projects.test.ts:20`                                   | `from "../../services/abstractions/CommandRunner.js"` | `from "../../services/CommandRunner/index.js"` |
| `src/api/routes/__tests__/changelogs.test.ts:8`                                  | `from "../../services/abstractions/CommandRunner.js"` | `from "../../services/CommandRunner/index.js"` |
| `src/api/routes/__tests__/packageManager.test.ts:22`                             | `from "../../services/abstractions/CommandRunner.js"` | `from "../../services/CommandRunner/index.js"` |
| `src/api/routes/__tests__/vulnerabilities.test.ts:14`                            | `from "#api/services/abstractions/CommandRunner.js"`  | `from "#api/services/CommandRunner/index.js"`  |
| `src/api/routes/__tests__/upgradeSessions.test.ts:25`                            | `from "#api/services/abstractions/CommandRunner.js"`  | `from "#api/services/CommandRunner/index.js"`  |
| `src/api/services/UpgradeService.ts:2`                                           | `from "./abstractions/CommandRunner.js"`              | `from "./CommandRunner/index.js"`              |
| `src/api/services/ForgeService.ts:6`                                             | `from "./abstractions/CommandRunner.js"`              | `from "./CommandRunner/index.js"`              |
| `src/api/services/GitService.ts:2`                                               | `from "./abstractions/CommandRunner.js"`              | `from "./CommandRunner/index.js"`              |
| `src/api/services/RegistryCacheService.ts:4`                                     | `from "./abstractions/CommandRunner.js"`              | `from "./CommandRunner/index.js"`              |
| `src/api/services/PackageManagerService.ts:4`                                    | `from "./abstractions/CommandRunner.js"`              | `from "./CommandRunner/index.js"`              |
| `src/api/services/UpgradeSessionService.ts:15`                                   | `from "./abstractions/CommandRunner.js"`              | `from "./CommandRunner/index.js"`              |
| `src/api/services/ScanService.ts:5`                                              | `from "./abstractions/CommandRunner.js"`              | `from "./CommandRunner/index.js"`              |
| `src/api/services/jobExecutors/CloneJobExecutor.ts:5`                            | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/jobExecutors/InstallJobExecutor.ts:5`                          | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/jobExecutors/__tests__/InstallJobExecutor.test.ts:7`           | `from "../../abstractions/CommandRunner.js"`          | `from "../../CommandRunner/index.js"`          |
| `src/api/services/jobExecutors/__tests__/CloneJobExecutor.test.ts:9`             | `from "../../abstractions/CommandRunner.js"`          | `from "../../CommandRunner/index.js"`          |
| `src/api/services/jobExecutors/__tests__/PackageScanJobExecutor.test.ts:9`       | `from "../../abstractions/CommandRunner.js"`          | `from "../../CommandRunner/index.js"`          |
| `src/api/services/__tests__/ScanService.test.ts:6`                               | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/RegistryCacheService.test.ts:12`                     | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/JobWorker.test.ts:16`                                | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/UpgradeSessionService.test.ts:17`                    | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/GitService.test.ts:3`                                | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/UpgradeService.test.ts:3`                            | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/PackageManagerService.test.ts:6`                     | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/ForgeService.test.ts:5`                              | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/__tests__/ChangelogService.test.ts:8`                          | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/changelogResolvers/GitHubReleasesResolver.ts:3`                | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/changelogResolvers/__tests__/GitHubReleasesResolver.test.ts:3` | `from "../../abstractions/CommandRunner.js"`          | `from "../../CommandRunner/index.js"`          |
| `src/api/services/changelogResolvers/ChangelogFileResolver.ts:3`                 | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/changelogResolvers/__tests__/ChangelogFileResolver.test.ts:3`  | `from "../../abstractions/CommandRunner.js"`          | `from "../../CommandRunner/index.js"`          |
| `src/api/services/stepResolvers/CustomStepResolver.ts:4`                         | `from "../abstractions/CommandRunner.js"`             | `from "../CommandRunner/index.js"`             |
| `src/api/services/stepResolvers/__tests__/CustomStepResolver.test.ts:4`          | `from "../../abstractions/CommandRunner.js"`          | `from "../../CommandRunner/index.js"`          |

- [ ] **Step 5: Update feature.ts import**

In `src/api/feature.ts`, replace:

```typescript
import { CommandRunner } from "./services/CommandRunner.js";
```

with:

```typescript
import { CommandRunnerFeature } from "./services/CommandRunner/index.js";
```

And replace `container.register(CommandRunner).inSingletonScope();` with `CommandRunnerFeature.register(container);`

- [ ] **Step 6: Update test import**

In `src/api/services/CommandRunner/__tests__/CommandRunner.test.ts`, update the import of the abstraction (was `from "../abstractions/CommandRunner.js"`, now `from "../abstractions/CommandRunner.js"` — path is still valid since test moved with it).

- [ ] **Step 7: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move CommandRunner into own service folder"
```

---

### Task 2: Email (ConsoleEmailService)

**Files:**

- Move: `src/api/services/abstractions/EmailService.ts` → `src/api/services/Email/abstractions/EmailService.ts`
- Move: `src/api/services/ConsoleEmailService.ts` → `src/api/services/Email/ConsoleEmailService.ts`
- Move: `src/api/services/__tests__/ConsoleEmailService.test.ts` → `src/api/services/Email/__tests__/ConsoleEmailService.test.ts`
- Create: `src/api/services/Email/feature.ts`
- Create: `src/api/services/Email/index.ts`

**Note:** Abstraction is named `EmailService`, implementation is `ConsoleEmailService`. The index.ts exports the `EmailService` abstraction.

- [ ] **Step 1: Create directories and move files**

```bash
mkdir -p src/api/services/Email/abstractions
mkdir -p src/api/services/Email/__tests__
mv src/api/services/abstractions/EmailService.ts src/api/services/Email/abstractions/EmailService.ts
mv src/api/services/ConsoleEmailService.ts src/api/services/Email/ConsoleEmailService.ts
mv src/api/services/__tests__/ConsoleEmailService.test.ts src/api/services/Email/__tests__/ConsoleEmailService.test.ts
```

- [ ] **Step 2: Update implementation imports**

In `src/api/services/Email/ConsoleEmailService.ts`, update:

```typescript
// OLD
import { EmailService } from "./abstractions/EmailService.js";
import { AppLogService } from "./abstractions/AppLogService.js";
```

to:

```typescript
import { EmailService } from "./abstractions/EmailService.js"; // unchanged
import { AppLogService } from "../AppLog/index.js"; // if AppLog already moved, otherwise "../abstractions/AppLogService.js"
```

**Important:** If AppLog has not been moved yet, keep the old path. The import will be updated when AppLog moves.

- [ ] **Step 3: Create feature.ts**

```typescript
import { createFeature } from "#shared/index.js";
import { ConsoleEmailService } from "./ConsoleEmailService.js";

export const EmailFeature = createFeature({
  name: "Api/EmailFeature",
  register(container) {
    container.register(ConsoleEmailService).inSingletonScope();
  }
});
```

- [ ] **Step 4: Create index.ts**

```typescript
export { EmailService } from "./abstractions/EmailService.js";
export { EmailFeature } from "./feature.js";
```

- [ ] **Step 5: Update all import paths**

Files importing `EmailService` abstraction:

| File                                                       | Old Import                                           | New Import                                                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/routes/__tests__/teams.test.ts:10`                | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/stepHooks.test.ts:13`            | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/users.test.ts:10`                | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/licenses.test.ts:11`             | `from "../../services/abstractions/EmailService.js"` | `from "../../services/Email/index.js"`                                                                                                                                      |
| `src/api/routes/__tests__/scanSchedules.test.ts:10`        | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/auth.test.ts:10`                 | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/logs.test.ts:10`                 | `from "../../services/abstractions/EmailService.js"` | `from "../../services/Email/index.js"`                                                                                                                                      |
| `src/api/routes/__tests__/jobs.test.ts:18`                 | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/cache.test.ts:14`                | `from "../../services/abstractions/EmailService.js"` | `from "../../services/Email/index.js"`                                                                                                                                      |
| `src/api/routes/__tests__/projects.test.ts:16`             | `from "../../services/abstractions/EmailService.js"` | `from "../../services/Email/index.js"`                                                                                                                                      |
| `src/api/routes/__tests__/changelogs.test.ts:9`            | `from "../../services/abstractions/EmailService.js"` | `from "../../services/Email/index.js"`                                                                                                                                      |
| `src/api/routes/__tests__/autoFix.test.ts:11`              | `from "../../services/abstractions/EmailService.js"` | `from "../../services/Email/index.js"`                                                                                                                                      |
| `src/api/routes/__tests__/settings.test.ts:16`             | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/packages.test.ts:8`              | `from "../../services/abstractions/EmailService.js"` | `from "../../services/Email/index.js"`                                                                                                                                      |
| `src/api/routes/__tests__/packageManager.test.ts:18`       | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/upgradeSessions.test.ts:8`       | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/dependencyGraph.test.ts:11`      | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/vulnerabilities.test.ts:10`      | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/backup.test.ts:10`               | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/routes/__tests__/appSettings.test.ts:14`          | `from "#api/services/abstractions/EmailService.js"`  | `from "#api/services/Email/index.js"`                                                                                                                                       |
| `src/api/services/AuthService.ts:6`                        | `from "./abstractions/EmailService.js"`              | `from "./Email/index.js"`                                                                                                                                                   |
| `src/api/services/__tests__/AuthService.test.ts:10`        | `from "../abstractions/EmailService.js"`             | `from "../Email/index.js"`                                                                                                                                                  |
| `src/api/services/__tests__/ConsoleEmailService.test.ts:3` | `from "../abstractions/EmailService.js"`             | `from "../abstractions/EmailService.js"` → `from "../Email/index.js"` (test moved into Email/**tests**/, so path changes to `"../index.js"` from within `Email/__tests__/`) |

**Fix for moved test:** In `src/api/services/Email/__tests__/ConsoleEmailService.test.ts`, the old import `from "../abstractions/EmailService.js"` becomes `from "../abstractions/EmailService.js"` — path still valid since test is now inside `Email/__tests__/` and abstraction is at `Email/abstractions/EmailService.ts`.

- [ ] **Step 6: Update feature.ts**

In `src/api/feature.ts`, replace:

```typescript
import { ConsoleEmailService } from "./services/ConsoleEmailService.js";
```

with:

```typescript
import { EmailFeature } from "./services/Email/index.js";
```

And replace `container.register(ConsoleEmailService).inSingletonScope();` with `EmailFeature.register(container);`

- [ ] **Step 7: Verify and commit**

```bash
yarn format:fix
git add -A
git commit -m "refactor: move Email service into own folder"
```
