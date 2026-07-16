# Security Settings — Plan 1: Shared Types & Field Registry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define PackageManagerId type in shared and create the per-PM security field registry.

**Architecture:** A `src/shared/security/` directory with types, per-PM field definitions, and a barrel export. The existing `TPackageManager` in the API is updated to re-export from shared.

**Tech Stack:** TypeScript, Zod

## Global Constraints

- oxfmt formatting (4-space indent for .ts files)
- oxlint linting
- Yarn 4 with node-modules linker
- All shared code under `src/shared/`
- Run `yarn build` after each task to verify compilation

---

### Task 1: PackageManagerId type + move TPackageManager

**Files:**

- Create: `src/shared/security/types.ts`
- Modify: `src/api/services/abstractions/PackageManagerService.ts`

**Interfaces:**

- Consumes: nothing
- Produces: `PackageManagerId` type (`"yarn" | "npm" | "pnpm"`), `SecurityFieldDefinition` interface

- [ ] **Step 1: Create types file**

```ts
// src/shared/security/types.ts
import type { z } from "zod";

export type PackageManagerId = "yarn" | "npm" | "pnpm";

export interface SecurityFieldDefinition {
  fieldName: string;
  configFile: string;
  description: string;
  expectedValueSchema: z.ZodType<string>;
  defaultExpectedValue: string;
}
```

- [ ] **Step 2: Update API PackageManagerService abstraction to re-export**

In `src/api/services/abstractions/PackageManagerService.ts`, replace the inline type:

```ts
// Before:
export type TPackageManager = "yarn" | "npm" | "pnpm";

// After:
export type { PackageManagerId as TPackageManager } from "#shared/security/types.js";
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build, no errors

- [ ] **Step 4: Run tests**

Run: `yarn test`
Expected: all 220+ tests pass (no behavior change)

- [ ] **Step 5: Commit**

```bash
git add src/shared/security/types.ts src/api/services/abstractions/PackageManagerService.ts
git commit -m "feat: add PackageManagerId and SecurityFieldDefinition shared types"
```

---

### Task 2: Yarn field definitions

**Files:**

- Create: `src/shared/security/yarn.ts`

**Interfaces:**

- Consumes: `SecurityFieldDefinition` from `types.ts`
- Produces: `YARN_SECURITY_FIELDS: SecurityFieldDefinition[]`

- [ ] **Step 1: Create yarn fields file**

```ts
// src/shared/security/yarn.ts
import { z } from "zod";
import type { SecurityFieldDefinition } from "./types.js";

export const YARN_SECURITY_FIELDS: SecurityFieldDefinition[] = [
  {
    fieldName: "npmPreapprovedPackages",
    configFile: ".yarnrc.yml",
    description: "List of pre-approved packages that skip audit checks",
    expectedValueSchema: z.string().min(1),
    defaultExpectedValue: "*"
  },
  {
    fieldName: "npmMinimalAgeGate",
    configFile: ".yarnrc.yml",
    description: "Minimum age a package version must have before install is allowed",
    expectedValueSchema: z.string().regex(/^\d+[dhms]$/, "Must be a duration like 0d, 7d, 24h"),
    defaultExpectedValue: "0d"
  },
  {
    fieldName: "enableScripts",
    configFile: ".yarnrc.yml",
    description: "Whether lifecycle scripts are allowed to run during install",
    expectedValueSchema: z.enum(["true", "false"]),
    defaultExpectedValue: "false"
  },
  {
    fieldName: "approvedGitRepositories",
    configFile: ".yarnrc.yml",
    description: "List of approved git repositories for git: dependencies",
    expectedValueSchema: z.string().min(1),
    defaultExpectedValue: "exists"
  }
];
```

- [ ] **Step 2: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add src/shared/security/yarn.ts
git commit -m "feat: add yarn security field definitions"
```

---

### Task 3: NPM and PNPM field definitions

**Files:**

- Create: `src/shared/security/npm.ts`
- Create: `src/shared/security/pnpm.ts`

**Interfaces:**

- Consumes: `SecurityFieldDefinition` from `types.ts`
- Produces: `NPM_SECURITY_FIELDS: SecurityFieldDefinition[]`, `PNPM_SECURITY_FIELDS: SecurityFieldDefinition[]`

- [ ] **Step 1: Create npm fields file (empty for now)**

```ts
// src/shared/security/npm.ts
import type { SecurityFieldDefinition } from "./types.js";

export const NPM_SECURITY_FIELDS: SecurityFieldDefinition[] = [];
```

- [ ] **Step 2: Create pnpm fields file (empty for now)**

```ts
// src/shared/security/pnpm.ts
import type { SecurityFieldDefinition } from "./types.js";

export const PNPM_SECURITY_FIELDS: SecurityFieldDefinition[] = [];
```

- [ ] **Step 3: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/shared/security/npm.ts src/shared/security/pnpm.ts
git commit -m "feat: add npm and pnpm security field definitions (empty)"
```

---

### Task 4: Barrel export + SECURITY_FIELD_REGISTRY

**Files:**

- Create: `src/shared/security/index.ts`

**Interfaces:**

- Consumes: all per-PM field arrays
- Produces: `SECURITY_FIELD_REGISTRY: Record<PackageManagerId, SecurityFieldDefinition[]>`

- [ ] **Step 1: Create barrel export**

```ts
// src/shared/security/index.ts
export { type PackageManagerId, type SecurityFieldDefinition } from "./types.js";
export { YARN_SECURITY_FIELDS } from "./yarn.js";
export { NPM_SECURITY_FIELDS } from "./npm.js";
export { PNPM_SECURITY_FIELDS } from "./pnpm.js";

import type { PackageManagerId, SecurityFieldDefinition } from "./types.js";
import { YARN_SECURITY_FIELDS } from "./yarn.js";
import { NPM_SECURITY_FIELDS } from "./npm.js";
import { PNPM_SECURITY_FIELDS } from "./pnpm.js";

export const SECURITY_FIELD_REGISTRY: Record<PackageManagerId, SecurityFieldDefinition[]> = {
  yarn: YARN_SECURITY_FIELDS,
  npm: NPM_SECURITY_FIELDS,
  pnpm: PNPM_SECURITY_FIELDS
};
```

- [ ] **Step 2: Build to verify**

Run: `yarn build`
Expected: clean build

- [ ] **Step 3: Run full pipeline**

Run: `yarn full`
Expected: adio + lint + format + build + test all pass

- [ ] **Step 4: Commit**

```bash
git add src/shared/security/index.ts
git commit -m "feat: add SECURITY_FIELD_REGISTRY barrel export"
```
