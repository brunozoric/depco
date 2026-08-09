# Restructure Batch 9: DependencyGraph + UpgradeSession + Auth Domains

> **For agentic workers:** Domain folders. UpgradeSession absorbs stepResolvers/ as subfolder.

**Goal:** Create DependencyGraph/, UpgradeSession/ (with stepResolvers/), and Auth/ (with UserService).

## Global Constraints

Same as prior batches.

---

### Task 1: DependencyGraph Domain

**Move:**

- `abstractions/DependencyGraphService.ts` → `DependencyGraph/abstractions/DependencyGraphService.ts`
- `abstractions/LockfileParserService.ts` → `DependencyGraph/abstractions/LockfileParserService.ts`
- `DependencyGraphService.ts` → `DependencyGraph/DependencyGraphService.ts`
- `LockfileParserService.ts` → `DependencyGraph/LockfileParserService.ts`
- `__tests__/DependencyGraphService.test.ts` → `DependencyGraph/__tests__/DependencyGraphService.test.ts`
- `__tests__/LockfileParserService.test.ts` → `DependencyGraph/__tests__/LockfileParserService.test.ts`

**feature.ts:**

```typescript
import { createFeature } from "#shared/index.js";
import { DependencyGraphService } from "./DependencyGraphService.js";
import { LockfileParserService } from "./LockfileParserService.js";

export const DependencyGraphFeature = createFeature({
  name: "Api/DependencyGraphFeature",
  register(container) {
    container.register(LockfileParserService).inSingletonScope();
    container.register(DependencyGraphService).inSingletonScope();
  }
});
```

**index.ts:**

```typescript
export { DependencyGraphService } from "./abstractions/DependencyGraphService.js";
export { LockfileParserService } from "./abstractions/LockfileParserService.js";
export { DependencyGraphFeature } from "./feature.js";
```

**Import updates:** Grep for all imports of DependencyGraphService and LockfileParserService abstractions/implementations. Update paths from `abstractions/DependencyGraphService.js` → `DependencyGraph/index.js` and from `abstractions/LockfileParserService.js` → `DependencyGraph/index.js`.

**Commit:** `refactor: move DependencyGraph services into domain folder`

---

### Task 2: UpgradeSession Domain

**This is complex.** Absorbs `stepResolvers/` as a subfolder and pulls in UpgradeSessionService from root.

**Move:**

- `abstractions/UpgradeSessionService.ts` → `UpgradeSession/abstractions/UpgradeSessionService.ts`
- `UpgradeSessionService.ts` → `UpgradeSession/UpgradeSessionService.ts`
- `__tests__/UpgradeSessionService.test.ts` → `UpgradeSession/__tests__/UpgradeSessionService.test.ts`
- `stepResolvers/` → `UpgradeSession/stepResolvers/` (entire directory including abstractions/, **tests**/, all resolvers)

**Directory structure after move:**

```
UpgradeSession/
  abstractions/
    UpgradeSessionService.ts
  stepResolvers/
    abstractions/
      StepResolver.ts
      CustomStepConfig.ts
      UpgradeSessionStepResolverRegistry.ts
    BranchResolver.ts
    CommitResolver.ts
    CustomStepResolver.ts
    PrResolver.ts
    PushResolver.ts
    RefreshTransientResolver.ts
    SelectPackagesResolver.ts
    UpgradeResolver.ts
    StepResolverRegistry.ts
    stepPipeline.ts
    __tests__/
      (all test files)
  UpgradeSessionService.ts
  feature.ts
  index.ts
  __tests__/
    UpgradeSessionService.test.ts
```

**feature.ts:**

```typescript
import { createFeature } from "#shared/index.js";
import { UpgradeSessionService } from "./UpgradeSessionService.js";
import { UpgradeSessionStepResolverRegistry } from "./stepResolvers/StepResolverRegistry.js";
import { SelectPackagesResolver } from "./stepResolvers/SelectPackagesResolver.js";
import { BranchResolver } from "./stepResolvers/BranchResolver.js";
import { UpgradeResolver } from "./stepResolvers/UpgradeResolver.js";
import { RefreshTransientResolver } from "./stepResolvers/RefreshTransientResolver.js";
import { CommitResolver } from "./stepResolvers/CommitResolver.js";
import { PushResolver } from "./stepResolvers/PushResolver.js";
import { PrResolver } from "./stepResolvers/PrResolver.js";

export const UpgradeSessionFeature = createFeature({
  name: "Api/UpgradeSessionFeature",
  register(container) {
    container.register(SelectPackagesResolver);
    container.register(BranchResolver);
    container.register(UpgradeResolver);
    container.register(RefreshTransientResolver);
    container.register(CommitResolver);
    container.register(PushResolver);
    container.register(PrResolver);
    container.register(UpgradeSessionStepResolverRegistry);
    container.register(UpgradeSessionService).inSingletonScope();
  }
});
```

**index.ts:**

```typescript
export { UpgradeSessionService } from "./abstractions/UpgradeSessionService.js";
export { UpgradeSessionStepResolverRegistry } from "./stepResolvers/abstractions/UpgradeSessionStepResolverRegistry.js";
export { UpgradeSessionFeature } from "./feature.js";
```

**Import updates:** Run these greps to find ALL imports that need updating:

```bash
grep -rn "from.*abstractions/UpgradeSessionService" src/api --include="*.ts"
grep -rn 'from.*services/UpgradeSessionService"' src/api --include="*.ts"
grep -rn "from.*stepResolvers/" src/api --include="*.ts" | grep -v "src/api/services/stepResolvers/"
grep -rn "from.*stepResolvers/" src/api/services/stepResolvers --include="*.ts"
```

Update: abstraction imports → `UpgradeSession/index.js`, step resolver imports → `UpgradeSession/stepResolvers/...`. Internal step resolver imports of other service abstractions (GitService, UpgradeService, CommandRunner, ForgeService) need path updates — they were `../abstractions/X.js`, now should be `../X/index.js` (if X already moved) or remain pointing to shared abstractions (if not yet moved).

**Commit:** `refactor: move UpgradeSession + stepResolvers into domain folder`

---

### Task 3: Auth Domain

**Move:**

- `abstractions/AuthService.ts` → `Auth/abstractions/AuthService.ts`
- `abstractions/UserService.ts` → `Auth/abstractions/UserService.ts`
- `AuthService.ts` → `Auth/AuthService.ts`
- `UserService.ts` → `Auth/UserService.ts`
- `__tests__/AuthService.test.ts` → `Auth/__tests__/AuthService.test.ts`
- `__tests__/UserService.test.ts` → `Auth/__tests__/UserService.test.ts`

**feature.ts:**

```typescript
import { createFeature } from "#shared/index.js";
import { UserService } from "./UserService.js";
import { AuthService } from "./AuthService.js";

export const AuthFeature = createFeature({
  name: "Api/AuthFeature",
  register(container) {
    container.register(UserService).inSingletonScope();
    container.register(AuthService).inSingletonScope();
  }
});
```

**index.ts:**

```typescript
export { AuthService } from "./abstractions/AuthService.js";
export { UserService } from "./abstractions/UserService.js";
export { AuthFeature } from "./feature.js";
```

**Import updates:**

- `src/api/server.ts:19` — `./services/abstractions/AuthService.js` → `./services/Auth/index.js`
- `src/api/middleware/authHook.ts:4` — `#api/services/abstractions/AuthService.js` → `#api/services/Auth/index.js`
- `src/api/websocket/WebSocketPlugin.ts:6` — `#api/services/abstractions/AuthService.js` → `#api/services/Auth/index.js`
- `src/api/routes/auth.ts` — update AuthService abstraction import
- `src/api/routes/users.ts` — update UserService abstraction import
- All route test files importing AuthService/UserService abstractions and implementations

**Commit:** `refactor: move Auth + User services into domain folder`
