# Restructure Batch 6: Git Domain + AutoFix Domain

> **For agentic workers:** Same pattern as prior batches. Domain folders contain multiple services.

**Goal:** Create Git/ (GitService + ForgeService) and AutoFix/ (AutoFixSettingsService + AutoFixPrService) domain folders.

## Global Constraints

Same as prior batches.

---

### Task 1: Git Domain

**Move:**
- `abstractions/GitService.ts` → `Git/abstractions/GitService.ts`
- `abstractions/ForgeService.ts` → `Git/abstractions/ForgeService.ts`
- `GitService.ts` → `Git/GitService.ts`
- `ForgeService.ts` → `Git/ForgeService.ts`
- `__tests__/GitService.test.ts` → `Git/__tests__/GitService.test.ts`
- `__tests__/ForgeService.test.ts` → `Git/__tests__/ForgeService.test.ts`

**feature.ts:**
```typescript
import { createFeature } from "#shared/index.js";
import { GitService } from "./GitService.js";
import { ForgeService } from "./ForgeService.js";

export const GitFeature = createFeature({
    name: "Api/GitFeature",
    register(container) {
        container.register(GitService).inSingletonScope();
        container.register(ForgeService).inSingletonScope();
    }
});
```

**index.ts:**
```typescript
export { GitService } from "./abstractions/GitService.js";
export { ForgeService } from "./abstractions/ForgeService.js";
export { GitFeature } from "./feature.js";
```

**GitService abstraction imports:**
- `src/api/routes/__tests__/upgradeSessions.test.ts:22` — `#api/services/abstractions/GitService.js` → `#api/services/Git/index.js`
- `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts:5` — `../abstractions/GitService.js` → `../Git/index.js`
- `src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts:8` — `../../abstractions/GitService.js` → `../../Git/index.js`
- `src/api/services/__tests__/UpgradeSessionService.test.ts:18` — `../abstractions/GitService.js` → `../Git/index.js`
- `src/api/services/stepResolvers/BranchResolver.ts:4` — `../abstractions/GitService.js` → `../Git/index.js`
- `src/api/services/stepResolvers/PushResolver.ts:4` — `../abstractions/GitService.js` → `../Git/index.js`
- `src/api/services/stepResolvers/PrResolver.ts:5` — `../abstractions/GitService.js` → `../Git/index.js`
- `src/api/services/stepResolvers/CommitResolver.ts:4` — `../abstractions/GitService.js` → `../Git/index.js`
- `src/api/services/stepResolvers/__tests__/PushResolver.test.ts:5` — `../../abstractions/GitService.js` → `../../Git/index.js`
- `src/api/services/stepResolvers/__tests__/PrResolver.test.ts:6` — `../../abstractions/GitService.js` → `../../Git/index.js`
- `src/api/services/stepResolvers/__tests__/BranchResolver.test.ts:5` — `../../abstractions/GitService.js` → `../../Git/index.js`
- `src/api/services/stepResolvers/__tests__/CommitResolver.test.ts:5` — `../../abstractions/GitService.js` → `../../Git/index.js`

**ForgeService abstraction imports:**
- `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts:6` — `../abstractions/ForgeService.js` → `../Git/index.js`
- `src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts:9` — `../../abstractions/ForgeService.js` → `../../Git/index.js`
- `src/api/services/stepResolvers/PrResolver.ts:4` — `../abstractions/ForgeService.js` → `../Git/index.js`
- `src/api/services/stepResolvers/__tests__/PrResolver.test.ts:5` — `../../abstractions/ForgeService.js` → `../../Git/index.js`

**Implementation imports (for DI in tests):**
- `src/api/routes/__tests__/jobs.test.ts:46` — `../../services/GitService.js` → `../../services/Git/GitService.js`
- `src/api/routes/__tests__/projects.test.ts:41` — `../../services/GitService.js` → `../../services/Git/GitService.js`
- `src/api/routes/__tests__/packageManager.test.ts:43` — `../../services/GitService.js` → `../../services/Git/GitService.js`
- `src/api/routes/__tests__/jobs.test.ts:48` — `../../services/ForgeService.js` → `../../services/Git/ForgeService.js`
- `src/api/routes/__tests__/projects.test.ts:43` — `../../services/ForgeService.js` → `../../services/Git/ForgeService.js`
- `src/api/routes/__tests__/packageManager.test.ts:45` — `../../services/ForgeService.js` → `../../services/Git/ForgeService.js`

**Internal cross-import:** ForgeService.ts imports CommandRunner and EncryptionService. These paths need updating based on whether those services have been moved already. If moved: `from "../CommandRunner/index.js"` and `from "../Encryption/index.js"`. If not yet moved: keep old paths.

**feature.ts update:** Replace GitService + ForgeService imports/registrations with `GitFeature`.

**Commit:** `refactor: move GitService + ForgeService into Git domain folder`

---

### Task 2: AutoFix Domain

**Move:**
- `abstractions/AutoFixSettingsService.ts` → `AutoFix/abstractions/AutoFixSettingsService.ts`
- `abstractions/AutoFixPrService.ts` → `AutoFix/abstractions/AutoFixPrService.ts`
- `AutoFixSettingsService.ts` → `AutoFix/AutoFixSettingsService.ts`
- `AutoFixPrService.ts` → `AutoFix/AutoFixPrService.ts`
- `__tests__/AutoFixSettingsService.test.ts` → `AutoFix/__tests__/AutoFixSettingsService.test.ts`
- `__tests__/AutoFixPrService.test.ts` → `AutoFix/__tests__/AutoFixPrService.test.ts`

**feature.ts:**
```typescript
import { createFeature } from "#shared/index.js";
import { AutoFixSettingsService } from "./AutoFixSettingsService.js";
import { AutoFixPrService } from "./AutoFixPrService.js";

export const AutoFixFeature = createFeature({
    name: "Api/AutoFixFeature",
    register(container) {
        container.register(AutoFixSettingsService).inSingletonScope();
        container.register(AutoFixPrService).inSingletonScope();
    }
});
```

**index.ts:**
```typescript
export { AutoFixSettingsService } from "./abstractions/AutoFixSettingsService.js";
export { AutoFixPrService } from "./abstractions/AutoFixPrService.js";
export { AutoFixFeature } from "./feature.js";
```

**AutoFixSettingsService abstraction imports:**
- `src/api/server.ts:18` — `./services/abstractions/AutoFixSettingsService.js` → `./services/AutoFix/index.js`
- `src/api/routes/autoFixSettings.ts:6` — `#api/services/abstractions/AutoFixSettingsService.js` → `#api/services/AutoFix/index.js`

**AutoFixPrService abstraction imports:**
- `src/api/services/jobExecutors/AutoFixPrJobExecutor.ts:4` — `../abstractions/AutoFixPrService.js` → `../AutoFix/index.js`
- `src/api/services/jobExecutors/__tests__/AutoFixPrJobExecutor.test.ts:7` — `../../abstractions/AutoFixPrService.js` → `../../AutoFix/index.js`
- `src/api/services/__tests__/AutoFixPrService.test.ts:5` — `#api/services/abstractions/AutoFixPrService.js` → `#api/services/AutoFix/index.js`

**Internal cross-import:** AutoFixPrService.ts imports AutoFixSettingsService and LicensePolicyService from abstractions. After move, AutoFixSettingsService import becomes `from "./abstractions/AutoFixSettingsService.js"` (internal). LicensePolicyService import depends on whether License domain has been moved.

**Implementation imports:**
- `src/api/routes/__tests__/jobs.test.ts:49` — `../../services/AutoFixSettingsService.js` → `../../services/AutoFix/AutoFixSettingsService.js`
- `src/api/routes/__tests__/autoFix.test.ts:10` — `../../services/AutoFixSettingsService.js` → `../../services/AutoFix/AutoFixSettingsService.js`
- `src/api/routes/__tests__/projects.test.ts:44` — `../../services/AutoFixSettingsService.js` → `../../services/AutoFix/AutoFixSettingsService.js`
- `src/api/routes/__tests__/packageManager.test.ts:46` — `../../services/AutoFixSettingsService.js` → `../../services/AutoFix/AutoFixSettingsService.js`
- `src/api/routes/__tests__/jobs.test.ts:50` — `../../services/AutoFixPrService.js` → `../../services/AutoFix/AutoFixPrService.js`
- `src/api/routes/__tests__/projects.test.ts:45` — `../../services/AutoFixPrService.js` → `../../services/AutoFix/AutoFixPrService.js`
- `src/api/routes/__tests__/packageManager.test.ts:47` — `../../services/AutoFixPrService.js` → `../../services/AutoFix/AutoFixPrService.js`

**Commit:** `refactor: move AutoFix services into domain folder`
