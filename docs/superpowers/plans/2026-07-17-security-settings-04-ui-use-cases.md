# Security Settings — Plan 4: UI Use Cases

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the 3 use cases that orchestrate gateway calls and repository updates for security settings.

**Architecture:** Each use case is abstraction + implementation in separate files, following existing `src/ui/presentation/projects/useCases/` pattern. All use optimistic repository updates (append/replace/filter, not full reload).

**Tech Stack:** TypeScript, `@webiny/di`

## Global Constraints

- One abstraction file per use case in `abstractions/`
- Optimistic updates: mutate repository with returned data, no full reload
- Run `yarn build` after each task

---

### Task 13: LoadSecuritySettingsUseCase

**Files:**

- Create: `src/ui/presentation/settings/useCases/abstractions/LoadSecuritySettingsUseCase.ts`
- Create: `src/ui/presentation/settings/useCases/LoadSecuritySettingsUseCase.ts`

**Interfaces:**

- Consumes: `SecuritySettingsGateway`, `SecuritySettingsRepository`
- Produces: `LoadSecuritySettingsUseCase` with `execute(): Promise<void>`

- [ ] **Step 1: Create abstraction**

```ts
// src/ui/presentation/settings/useCases/abstractions/LoadSecuritySettingsUseCase.ts
import { createAbstraction } from "#shared/index.js";

export interface ILoadSecuritySettingsUseCase {
  execute(): Promise<void>;
}

export const LoadSecuritySettingsUseCase = createAbstraction<ILoadSecuritySettingsUseCase>(
  "Ui/LoadSecuritySettingsUseCase"
);

export namespace LoadSecuritySettingsUseCase {
  export type Interface = ILoadSecuritySettingsUseCase;
}
```

- [ ] **Step 2: Create implementation**

```ts
// src/ui/presentation/settings/useCases/LoadSecuritySettingsUseCase.ts
import { LoadSecuritySettingsUseCase as Abstraction } from "./abstractions/LoadSecuritySettingsUseCase.js";
import { SecuritySettingsGateway } from "../../../features/settings/abstractions/SecuritySettingsGateway.js";
import { SecuritySettingsRepository } from "../../../features/settings/abstractions/SecuritySettingsRepository.js";

class LoadSecuritySettingsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: SecuritySettingsGateway.Interface,
    private readonly repository: SecuritySettingsRepository.Interface
  ) {}

  public execute = async (): Promise<void> => {
    const settings = await this.gateway.list();
    this.repository.setSettings(settings);
  };
}

export const LoadSecuritySettingsUseCase = Abstraction.createImplementation({
  implementation: LoadSecuritySettingsUseCaseImpl,
  dependencies: [SecuritySettingsGateway, SecuritySettingsRepository]
});
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/useCases/abstractions/LoadSecuritySettingsUseCase.ts src/ui/presentation/settings/useCases/LoadSecuritySettingsUseCase.ts
git commit -m "feat: add LoadSecuritySettingsUseCase"
```

---

### Task 14: CreateSecuritySettingUseCase

**Files:**

- Create: `src/ui/presentation/settings/useCases/abstractions/CreateSecuritySettingUseCase.ts`
- Create: `src/ui/presentation/settings/useCases/CreateSecuritySettingUseCase.ts`

**Interfaces:**

- Consumes: `SecuritySettingsGateway`, `SecuritySettingsRepository`
- Produces: `CreateSecuritySettingUseCase` with `execute(packageManager, fieldName, expectedValue): Promise<void>`

- [ ] **Step 1: Create abstraction**

```ts
// src/ui/presentation/settings/useCases/abstractions/CreateSecuritySettingUseCase.ts
import { createAbstraction } from "#shared/index.js";

export interface ICreateSecuritySettingUseCase {
  execute(packageManager: string, fieldName: string, expectedValue: string): Promise<void>;
}

export const CreateSecuritySettingUseCase = createAbstraction<ICreateSecuritySettingUseCase>(
  "Ui/CreateSecuritySettingUseCase"
);

export namespace CreateSecuritySettingUseCase {
  export type Interface = ICreateSecuritySettingUseCase;
}
```

- [ ] **Step 2: Create implementation**

```ts
// src/ui/presentation/settings/useCases/CreateSecuritySettingUseCase.ts
import { CreateSecuritySettingUseCase as Abstraction } from "./abstractions/CreateSecuritySettingUseCase.js";
import { SecuritySettingsGateway } from "../../../features/settings/abstractions/SecuritySettingsGateway.js";
import { SecuritySettingsRepository } from "../../../features/settings/abstractions/SecuritySettingsRepository.js";

class CreateSecuritySettingUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: SecuritySettingsGateway.Interface,
    private readonly repository: SecuritySettingsRepository.Interface
  ) {}

  public execute = async (
    packageManager: string,
    fieldName: string,
    expectedValue: string
  ): Promise<void> => {
    const setting = await this.gateway.create(packageManager, fieldName, expectedValue);
    this.repository.addSetting(setting);
  };
}

export const CreateSecuritySettingUseCase = Abstraction.createImplementation({
  implementation: CreateSecuritySettingUseCaseImpl,
  dependencies: [SecuritySettingsGateway, SecuritySettingsRepository]
});
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/useCases/abstractions/CreateSecuritySettingUseCase.ts src/ui/presentation/settings/useCases/CreateSecuritySettingUseCase.ts
git commit -m "feat: add CreateSecuritySettingUseCase"
```

---

### Task 15: UpdateSecuritySettingUseCase

**Files:**

- Create: `src/ui/presentation/settings/useCases/abstractions/UpdateSecuritySettingUseCase.ts`
- Create: `src/ui/presentation/settings/useCases/UpdateSecuritySettingUseCase.ts`

**Interfaces:**

- Consumes: `SecuritySettingsGateway`, `SecuritySettingsRepository`
- Produces: `UpdateSecuritySettingUseCase` with `execute(id, expectedValue): Promise<void>`

- [ ] **Step 1: Create abstraction**

```ts
// src/ui/presentation/settings/useCases/abstractions/UpdateSecuritySettingUseCase.ts
import { createAbstraction } from "#shared/index.js";

export interface IUpdateSecuritySettingUseCase {
  execute(id: string, expectedValue: string): Promise<void>;
}

export const UpdateSecuritySettingUseCase = createAbstraction<IUpdateSecuritySettingUseCase>(
  "Ui/UpdateSecuritySettingUseCase"
);

export namespace UpdateSecuritySettingUseCase {
  export type Interface = IUpdateSecuritySettingUseCase;
}
```

- [ ] **Step 2: Create implementation**

```ts
// src/ui/presentation/settings/useCases/UpdateSecuritySettingUseCase.ts
import { UpdateSecuritySettingUseCase as Abstraction } from "./abstractions/UpdateSecuritySettingUseCase.js";
import { SecuritySettingsGateway } from "../../../features/settings/abstractions/SecuritySettingsGateway.js";
import { SecuritySettingsRepository } from "../../../features/settings/abstractions/SecuritySettingsRepository.js";

class UpdateSecuritySettingUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: SecuritySettingsGateway.Interface,
    private readonly repository: SecuritySettingsRepository.Interface
  ) {}

  public execute = async (id: string, expectedValue: string): Promise<void> => {
    await this.gateway.update(id, expectedValue);
    this.repository.updateSetting(id, expectedValue);
  };
}

export const UpdateSecuritySettingUseCase = Abstraction.createImplementation({
  implementation: UpdateSecuritySettingUseCaseImpl,
  dependencies: [SecuritySettingsGateway, SecuritySettingsRepository]
});
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/useCases/abstractions/UpdateSecuritySettingUseCase.ts src/ui/presentation/settings/useCases/UpdateSecuritySettingUseCase.ts
git commit -m "feat: add UpdateSecuritySettingUseCase"
```

---

### Task 16: RemoveSecuritySettingUseCase

**Files:**

- Create: `src/ui/presentation/settings/useCases/abstractions/RemoveSecuritySettingUseCase.ts`
- Create: `src/ui/presentation/settings/useCases/RemoveSecuritySettingUseCase.ts`

**Interfaces:**

- Consumes: `SecuritySettingsGateway`, `SecuritySettingsRepository`
- Produces: `RemoveSecuritySettingUseCase` with `execute(id): Promise<void>`

- [ ] **Step 1: Create abstraction**

```ts
// src/ui/presentation/settings/useCases/abstractions/RemoveSecuritySettingUseCase.ts
import { createAbstraction } from "#shared/index.js";

export interface IRemoveSecuritySettingUseCase {
  execute(id: string): Promise<void>;
}

export const RemoveSecuritySettingUseCase = createAbstraction<IRemoveSecuritySettingUseCase>(
  "Ui/RemoveSecuritySettingUseCase"
);

export namespace RemoveSecuritySettingUseCase {
  export type Interface = IRemoveSecuritySettingUseCase;
}
```

- [ ] **Step 2: Create implementation**

```ts
// src/ui/presentation/settings/useCases/RemoveSecuritySettingUseCase.ts
import { RemoveSecuritySettingUseCase as Abstraction } from "./abstractions/RemoveSecuritySettingUseCase.js";
import { SecuritySettingsGateway } from "../../../features/settings/abstractions/SecuritySettingsGateway.js";
import { SecuritySettingsRepository } from "../../../features/settings/abstractions/SecuritySettingsRepository.js";

class RemoveSecuritySettingUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: SecuritySettingsGateway.Interface,
    private readonly repository: SecuritySettingsRepository.Interface
  ) {}

  public execute = async (id: string): Promise<void> => {
    await this.gateway.remove(id);
    this.repository.removeSetting(id);
  };
}

export const RemoveSecuritySettingUseCase = Abstraction.createImplementation({
  implementation: RemoveSecuritySettingUseCaseImpl,
  dependencies: [SecuritySettingsGateway, SecuritySettingsRepository]
});
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/ui/presentation/settings/useCases/abstractions/RemoveSecuritySettingUseCase.ts src/ui/presentation/settings/useCases/RemoveSecuritySettingUseCase.ts
git commit -m "feat: add RemoveSecuritySettingUseCase"
```

---

### Task 17: SecuritySettingsUseCasesFeature

**Files:**

- Create: `src/ui/presentation/settings/useCases/feature.ts`

**Interfaces:**

- Consumes: `SecuritySettingsFeature`, all 4 use case implementations
- Produces: `SecuritySettingsUseCasesFeature`

- [ ] **Step 1: Create feature file**

```ts
// src/ui/presentation/settings/useCases/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { SecuritySettingsFeature } from "../../../features/settings/feature.js";
import { LoadSecuritySettingsUseCase } from "./LoadSecuritySettingsUseCase.js";
import { CreateSecuritySettingUseCase } from "./CreateSecuritySettingUseCase.js";
import { UpdateSecuritySettingUseCase } from "./UpdateSecuritySettingUseCase.js";
import { RemoveSecuritySettingUseCase } from "./RemoveSecuritySettingUseCase.js";

export const SecuritySettingsUseCasesFeature = createFeature({
  name: "Ui/SecuritySettingsUseCases",
  dependencies: [SecuritySettingsFeature],
  register(container: Container) {
    container.register(LoadSecuritySettingsUseCase);
    container.register(CreateSecuritySettingUseCase);
    container.register(UpdateSecuritySettingUseCase);
    container.register(RemoveSecuritySettingUseCase);
  }
});
```

- [ ] **Step 2: Build + full pipeline**

Run: `yarn full`
Expected: all green

- [ ] **Step 3: Commit**

```bash
git add src/ui/presentation/settings/useCases/feature.ts
git commit -m "feat: add SecuritySettingsUseCasesFeature"
```
