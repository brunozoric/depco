# Security Settings — Plan 3: UI Gateway & Repository

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the headless data layer for security settings — gateway (HTTP calls) and repository (in-memory store) with DI feature registration.

**Architecture:** Follows existing `src/ui/features/projects/` pattern exactly. Abstractions with `createAbstraction` + namespace, implementations with `createImplementation`, feature with `createFeature`.

**Tech Stack:** TypeScript, `@webiny/di`

## Global Constraints

- Every abstraction in its own file under `abstractions/`
- Namespace with exported types (`Foo.Interface`, etc.)
- `Impl` suffix only on class declaration
- Barrel exports: only abstractions and features
- Run `yarn build` after each task

---

### Task 9: SecuritySettingsGateway abstraction

**Files:**

- Create: `src/ui/features/settings/abstractions/SecuritySettingsGateway.ts`

**Interfaces:**

- Consumes: `createAbstraction` from `#shared/index.js`
- Produces: `SecuritySettingsGateway` abstraction with `Interface`, `SecuritySetting` types

- [ ] **Step 1: Create gateway abstraction**

```ts
// src/ui/features/settings/abstractions/SecuritySettingsGateway.ts
import { createAbstraction } from "#shared/index.js";

export interface ISecuritySetting {
  id: string;
  packageManager: string;
  configFile: string;
  fieldName: string;
  expectedValue: string;
}

export interface ISecuritySettingsGateway {
  list(): Promise<ISecuritySetting[]>;
  create(
    packageManager: string,
    fieldName: string,
    expectedValue: string
  ): Promise<ISecuritySetting>;
  update(id: string, expectedValue: string): Promise<ISecuritySetting>;
  remove(id: string): Promise<void>;
}

export const SecuritySettingsGateway = createAbstraction<ISecuritySettingsGateway>(
  "Ui/SecuritySettingsGateway"
);

export namespace SecuritySettingsGateway {
  export type Interface = ISecuritySettingsGateway;
  export type SecuritySetting = ISecuritySetting;
}
```

- [ ] **Step 2: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add src/ui/features/settings/abstractions/SecuritySettingsGateway.ts
git commit -m "feat: add SecuritySettingsGateway abstraction"
```

---

### Task 10: SecuritySettingsGateway implementation

**Files:**

- Create: `src/ui/features/settings/SecuritySettingsGateway.ts`

**Interfaces:**

- Consumes: `SecuritySettingsGateway` abstraction, `HTTPClient` abstraction, all 4 route definitions from `#shared/routes/index.js`
- Produces: `SecuritySettingsGateway` implementation registration

- [ ] **Step 1: Create gateway implementation**

```ts
// src/ui/features/settings/SecuritySettingsGateway.ts
import { SecuritySettingsGateway as Abstraction } from "./abstractions/SecuritySettingsGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import {
  listSecuritySettingsRoute,
  createSecuritySettingRoute,
  updateSecuritySettingRoute,
  deleteSecuritySettingRoute
} from "#shared/routes/index.js";

class SecuritySettingsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(): Promise<Abstraction.SecuritySetting[]> {
    const response = await this.httpClient.request(listSecuritySettingsRoute, {});
    return response.items;
  }

  public async create(
    packageManager: string,
    fieldName: string,
    expectedValue: string
  ): Promise<Abstraction.SecuritySetting> {
    const response = await this.httpClient.request(createSecuritySettingRoute, {
      body: { packageManager, fieldName, expectedValue }
    });
    return response.item;
  }

  public async update(id: string, expectedValue: string): Promise<Abstraction.SecuritySetting> {
    const response = await this.httpClient.request(updateSecuritySettingRoute, {
      params: { id },
      body: { expectedValue }
    });
    return response.item;
  }

  public async remove(id: string): Promise<void> {
    await this.httpClient.request(deleteSecuritySettingRoute, {
      params: { id }
    });
  }
}

export const SecuritySettingsGateway = Abstraction.createImplementation({
  implementation: SecuritySettingsGatewayImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 2: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add src/ui/features/settings/SecuritySettingsGateway.ts
git commit -m "feat: add SecuritySettingsGateway implementation"
```

---

### Task 11: SecuritySettingsRepository abstraction + implementation

**Files:**

- Create: `src/ui/features/settings/abstractions/SecuritySettingsRepository.ts`
- Create: `src/ui/features/settings/SecuritySettingsRepository.ts`

**Interfaces:**

- Consumes: `createAbstraction` from `#shared/index.js`, `SecuritySettingsGateway.SecuritySetting`
- Produces: `SecuritySettingsRepository` with `getSettings`, `setSettings`, `addSetting`, `updateSetting`, `removeSetting`

- [ ] **Step 1: Create repository abstraction**

```ts
// src/ui/features/settings/abstractions/SecuritySettingsRepository.ts
import { createAbstraction } from "#shared/index.js";
import { SecuritySettingsGateway } from "./SecuritySettingsGateway.js";

export interface ISecuritySettingsRepository {
  getSettings(): SecuritySettingsGateway.SecuritySetting[];
  setSettings(settings: SecuritySettingsGateway.SecuritySetting[]): void;
  addSetting(setting: SecuritySettingsGateway.SecuritySetting): void;
  updateSetting(id: string, expectedValue: string): void;
  removeSetting(id: string): void;
}

export const SecuritySettingsRepository = createAbstraction<ISecuritySettingsRepository>(
  "Ui/SecuritySettingsRepository"
);

export namespace SecuritySettingsRepository {
  export type Interface = ISecuritySettingsRepository;
  export type SecuritySetting = SecuritySettingsGateway.SecuritySetting;
}
```

- [ ] **Step 2: Create repository implementation**

```ts
// src/ui/features/settings/SecuritySettingsRepository.ts
import { SecuritySettingsRepository as Abstraction } from "./abstractions/SecuritySettingsRepository.js";

class SecuritySettingsRepositoryImpl implements Abstraction.Interface {
  private settings: Abstraction.SecuritySetting[] = [];

  public getSettings(): Abstraction.SecuritySetting[] {
    return this.settings;
  }

  public setSettings(settings: Abstraction.SecuritySetting[]): void {
    this.settings = settings;
  }

  public addSetting(setting: Abstraction.SecuritySetting): void {
    this.settings = [...this.settings, setting];
  }

  public updateSetting(id: string, expectedValue: string): void {
    this.settings = this.settings.map(s => (s.id === id ? { ...s, expectedValue } : s));
  }

  public removeSetting(id: string): void {
    this.settings = this.settings.filter(s => s.id !== id);
  }
}

export const SecuritySettingsRepository = Abstraction.createImplementation({
  implementation: SecuritySettingsRepositoryImpl,
  dependencies: []
});
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/ui/features/settings/abstractions/SecuritySettingsRepository.ts src/ui/features/settings/SecuritySettingsRepository.ts
git commit -m "feat: add SecuritySettingsRepository abstraction and implementation"
```

---

### Task 12: Barrel exports + SecuritySettingsFeature registration

**Files:**

- Create: `src/ui/features/settings/abstractions/index.ts`
- Create: `src/ui/features/settings/index.ts`
- Create: `src/ui/features/settings/feature.ts`

**Interfaces:**

- Consumes: `SecuritySettingsGateway`, `SecuritySettingsRepository` implementations
- Produces: `SecuritySettingsFeature` for DI registration, barrel exports for App.tsx

- [ ] **Step 1: Create abstractions barrel**

```ts
// src/ui/features/settings/abstractions/index.ts
export { SecuritySettingsGateway } from "./SecuritySettingsGateway.js";
export { SecuritySettingsRepository } from "./SecuritySettingsRepository.js";
```

- [ ] **Step 2: Create feature file**

```ts
// src/ui/features/settings/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { SecuritySettingsGateway } from "./SecuritySettingsGateway.js";
import { SecuritySettingsRepository } from "./SecuritySettingsRepository.js";

export const SecuritySettingsFeature = createFeature({
  name: "Ui/SecuritySettings",
  register(container: Container) {
    container.register(SecuritySettingsGateway).inSingletonScope();
    container.register(SecuritySettingsRepository).inSingletonScope();
  }
});
```

- [ ] **Step 3: Create feature barrel export**

```ts
// src/ui/features/settings/index.ts
export { SecuritySettingsGateway } from "./abstractions/index.js";
export { SecuritySettingsRepository } from "./abstractions/index.js";
export { SecuritySettingsFeature } from "./feature.js";
```

- [ ] **Step 4: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 5: Run full pipeline**

Run: `yarn full`
Expected: all green

- [ ] **Step 4: Commit**

```bash
git add src/ui/features/settings/abstractions/index.ts src/ui/features/settings/index.ts src/ui/features/settings/feature.ts
git commit -m "feat: add SecuritySettingsFeature with barrel exports"
```
