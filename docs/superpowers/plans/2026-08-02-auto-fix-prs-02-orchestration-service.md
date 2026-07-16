# Auto-Fix PRs Part 2: AutoFixPrService (Orchestration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AutoFixPrService — the orchestration brain that determines which packages get PRs, checks license gates, groups packages, and creates pending PR records.

**Architecture:** AutoFixPrService reads scan results, filters by upgrade type config, checks license policy, detects duplicate PRs, groups by strategy, creates pending records, and builds PR body markdown.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, vitest

## Global Constraints

- Use full words in identifiers — no abbreviations
- Named interfaces only — no inline structural types
- Abstraction and implementation in separate files, separate directories
- Real SQLite in-memory for tests — use `createTestDatabaseClient()`
- Yarn for package management
- Tests in `src/**/__tests__/**/*.test.ts`

---

### Task 4: AutoFixPrService abstraction and PR body builder

**Files:**

- Create: `src/api/services/abstractions/AutoFixPrService.ts`
- Create: `src/api/services/AutoFixPrService.ts`
- Create: `src/api/services/__tests__/AutoFixPrService.test.ts`
- Modify: `src/api/feature.ts` (register service)

**Interfaces:**

- Consumes:
  - `DatabaseClient.Interface` — queries `scanResults`, `autoFixPullRequests`, `changelogs`, `dependencies`, `dependencyVersions` tables
  - `AutoFixSettingsService.Interface` (Task 3) — `getSettingsOrDefaults(projectId)`
  - `LicensePolicyService.Interface` — `evaluate(projectId, licenses)` returns violations with `action: "warn" | "deny"`
  - `licenses` table — to look up license info for target versions
- Produces: `AutoFixPrService.Interface` with:
  - `generateForProject(projectId: string): Promise<AutoFixPrService.GenerateResult>`
  - `buildPrBody(packages: AutoFixPrService.PackageUpgrade[], changelogs: AutoFixPrService.ChangelogExcerpt[], licenseWarnings: string[]): string`
  - `GenerateResult = { pending: AutoFixPullRequest[], skippedDeny: string[], skippedDuplicate: string[] }`
  - `PackageUpgrade = { packageName, fromVersion, toVersion, upgradeType }`
  - `ChangelogExcerpt = { packageName, version, content: string | null }`

- [ ] **Step 1: Create abstraction**

Create `src/api/services/abstractions/AutoFixPrService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IPackageUpgrade {
  packageName: string;
  fromVersion: string;
  toVersion: string;
  upgradeType: string;
}

export interface IChangelogExcerpt {
  packageName: string;
  version: string;
  content: string | null;
}

export interface IAutoFixGenerateResult {
  pending: IAutoFixPullRequestRecord[];
  skippedDeny: string[];
  skippedDuplicate: string[];
}

export interface IAutoFixPullRequestRecord {
  id: string;
  projectId: string;
  packageNames: string[];
  fromVersions: Record<string, string>;
  toVersions: Record<string, string>;
  upgradeType: string;
  branchName: string;
  status: string;
  licenseWarnings: string[];
}

export interface IAutoFixPrService {
  generateForProject(projectId: string): Promise<IAutoFixGenerateResult>;
  buildPrBody(
    packages: IPackageUpgrade[],
    changelogs: IChangelogExcerpt[],
    licenseWarnings: string[]
  ): string;
}

export const AutoFixPrService = createAbstraction<IAutoFixPrService>("Api/AutoFixPrService");

export namespace AutoFixPrService {
  export type Interface = IAutoFixPrService;
  export type PackageUpgrade = IPackageUpgrade;
  export type ChangelogExcerpt = IChangelogExcerpt;
  export type GenerateResult = IAutoFixGenerateResult;
  export type PullRequestRecord = IAutoFixPullRequestRecord;
}
```

- [ ] **Step 2: Write tests**

Create `src/api/services/__tests__/AutoFixPrService.test.ts` covering:

1. **Filters by upgrade type**: Project has patch + minor upgrades, settings only allow patch → only patch packages returned
2. **License deny blocks package**: Package whose target version has a "deny" license violation → skippedDeny
3. **License warn passes with warnings**: Package with "warn" violation → included in pending with licenseWarnings populated
4. **Duplicate PR detection**: Package already has open PR (status "created") → skippedDuplicate
5. **Grouping per-package**: 3 eligible packages → 3 pending records
6. **Grouping per-project**: 3 eligible packages → 1 pending record with all 3
7. **Grouping per-upgrade-type**: 2 patch + 1 minor → 2 pending records
8. **PR body builder**: Contains upgrade table, changelog excerpts, license warnings, footer
9. **PR body without changelogs**: No changelog data → no changelog section in body
10. **No outdated packages**: All up-to-date → empty result

Test setup: real DB with projects, scanResults (with upgradeType "patch"/"minor"/"major"/"none"), autoFixSettings, and optionally autoFixPullRequests + licenses + licensePolicyRules.

For the license gate tests, insert license data and policy rules so `LicensePolicyService.evaluate()` produces the expected violations. Use the real `LicensePolicyService` (already built in Task 4 of the license compliance feature).

- [ ] **Step 3: Write implementation**

Create `src/api/services/AutoFixPrService.ts`. Key logic:

```typescript
import { eq, and, or, inArray } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { AutoFixPrService as Abstraction } from "./abstractions/AutoFixPrService.js";
import { AutoFixSettingsService } from "./abstractions/AutoFixSettingsService.js";
import { LicensePolicyService } from "./abstractions/LicensePolicyService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
  scanResults,
  autoFixPullRequests,
  licenses,
  changelogs,
  dependencies,
  dependencyVersions
} from "#api/db/schema.js";

// generateForProject():
// 1. const settings = await this.autoFixSettingsService.getSettingsOrDefaults(projectId);
// 2. Load scanResults where upgradeType in settings.upgradeTypes and upgradeType !== "none"
// 3. For each package, check license gate:
//    - Query licenses table for this package + project
//    - If license exists, run licensePolicyService.evaluate() with that license
//    - If any violation.action === "deny" → add to skippedDeny, skip
//    - If any violation.action === "warn" → collect warning strings
// 4. Check for existing open PRs (status "pending" or "created") for same packages
//    - Parse packageNames JSON array from existing records
//    - Skip packages already covered → add to skippedDuplicate
// 5. Group remaining packages by settings.groupingStrategy
// 6. For each group, create autoFixPullRequests record with status "pending"
//    - branchName: settings.branchPrefix + slug (package name + version for per-package, "all-upgrades" for per-project, "patch-upgrades"/"minor-upgrades" for per-upgrade-type)
// 7. Return { pending, skippedDeny, skippedDuplicate }

// buildPrBody():
// Returns markdown string with:
// - "## Dependency Upgrade" header
// - Table: | Package | From | To | Type |
// - If changelogs: "## Changelog" section with per-package excerpts
// - If licenseWarnings: "## License Warnings" section with bullet list
// - Footer: "---\n*Generated by Dependency Manager*"
```

The implementation should follow the exact logic above. The `buildPrBody` method is a pure function — no DB access.

- [ ] **Step 4: Register in DI**

In `src/api/feature.ts`, import and register `AutoFixPrService`.

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/services/__tests__/AutoFixPrService.test.ts`
Expected: PASS — all 10 tests

- [ ] **Step 6: Run full suite**

Run: `yarn build && yarn test`
Expected: clean

- [ ] **Step 7: Commit**

```bash
git add src/api/services/abstractions/AutoFixPrService.ts src/api/services/AutoFixPrService.ts src/api/services/__tests__/AutoFixPrService.test.ts src/api/feature.ts
git commit -m "feat(auto-fix): add AutoFixPrService with license gate, grouping, and PR body builder"
```
