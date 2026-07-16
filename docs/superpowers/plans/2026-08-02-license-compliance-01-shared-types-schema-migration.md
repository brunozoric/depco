# License Compliance Part 1: Shared Types, Schema & Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the shared license types, risk tier mapping, DB schema tables, and migration for license compliance.

**Architecture:** Shared types in `src/shared/licenses/types.ts` define risk tiers and constants. Three new DB tables (`licenses`, `license_policy_rules`, `license_violations`) added via migration 0006. Schema definitions in `src/api/db/schema.ts`.

**Tech Stack:** TypeScript, Drizzle ORM, SQLite, Zod

## Global Constraints

- Use full words in identifiers — "Vulnerability" not "Vuln", "License" not "Lic"
- Named interfaces only — no inline structural types
- Follow existing DI abstraction pattern: `createAbstraction` + namespace exports
- Real SQLite in-memory for tests — no DB mocks
- Yarn for package management

---

### Task 1: Shared License Types and Risk Tier Mapping

**Files:**

- Create: `src/shared/licenses/types.ts`

**Interfaces:**

- Produces: `LICENSE_RISK_TIERS` (const map of SPDX ids to risk tier), `LicenseRiskTier` type, `RISK_TIER_VALUES` const array, `classifyLicenseRiskTier(spdxId: string | null): LicenseRiskTier` function

- [ ] **Step 1: Write the failing test**

Create `src/shared/licenses/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  classifyLicenseRiskTier,
  RISK_TIER_VALUES,
  LICENSE_RISK_TIERS
} from "#shared/licenses/types.js";

describe("classifyLicenseRiskTier()", () => {
  it("should classify MIT as permissive", () => {
    expect(classifyLicenseRiskTier("MIT")).toBe("permissive");
  });

  it("should classify Apache-2.0 as permissive", () => {
    expect(classifyLicenseRiskTier("Apache-2.0")).toBe("permissive");
  });

  it("should classify ISC as permissive", () => {
    expect(classifyLicenseRiskTier("ISC")).toBe("permissive");
  });

  it("should classify BSD-2-Clause as permissive", () => {
    expect(classifyLicenseRiskTier("BSD-2-Clause")).toBe("permissive");
  });

  it("should classify BSD-3-Clause as permissive", () => {
    expect(classifyLicenseRiskTier("BSD-3-Clause")).toBe("permissive");
  });

  it("should classify 0BSD as permissive", () => {
    expect(classifyLicenseRiskTier("0BSD")).toBe("permissive");
  });

  it("should classify Unlicense as permissive", () => {
    expect(classifyLicenseRiskTier("Unlicense")).toBe("permissive");
  });

  it("should classify CC0-1.0 as permissive", () => {
    expect(classifyLicenseRiskTier("CC0-1.0")).toBe("permissive");
  });

  it("should classify LGPL-2.1 as weak-copyleft", () => {
    expect(classifyLicenseRiskTier("LGPL-2.1")).toBe("weak-copyleft");
  });

  it("should classify LGPL-3.0 as weak-copyleft", () => {
    expect(classifyLicenseRiskTier("LGPL-3.0")).toBe("weak-copyleft");
  });

  it("should classify MPL-2.0 as weak-copyleft", () => {
    expect(classifyLicenseRiskTier("MPL-2.0")).toBe("weak-copyleft");
  });

  it("should classify EPL-1.0 as weak-copyleft", () => {
    expect(classifyLicenseRiskTier("EPL-1.0")).toBe("weak-copyleft");
  });

  it("should classify EPL-2.0 as weak-copyleft", () => {
    expect(classifyLicenseRiskTier("EPL-2.0")).toBe("weak-copyleft");
  });

  it("should classify GPL-2.0 as copyleft", () => {
    expect(classifyLicenseRiskTier("GPL-2.0")).toBe("copyleft");
  });

  it("should classify GPL-3.0 as copyleft", () => {
    expect(classifyLicenseRiskTier("GPL-3.0")).toBe("copyleft");
  });

  it("should classify AGPL-3.0 as copyleft", () => {
    expect(classifyLicenseRiskTier("AGPL-3.0")).toBe("copyleft");
  });

  it("should classify UNLICENSED as proprietary", () => {
    expect(classifyLicenseRiskTier("UNLICENSED")).toBe("proprietary");
  });

  it("should classify null as unknown", () => {
    expect(classifyLicenseRiskTier(null)).toBe("unknown");
  });

  it("should classify unrecognized SPDX id as unknown", () => {
    expect(classifyLicenseRiskTier("SomeCustomLicense")).toBe("unknown");
  });

  it("should classify empty string as unknown", () => {
    expect(classifyLicenseRiskTier("")).toBe("unknown");
  });
});

describe("RISK_TIER_VALUES", () => {
  it("should contain all five risk tiers", () => {
    expect(RISK_TIER_VALUES).toEqual([
      "permissive",
      "weak-copyleft",
      "copyleft",
      "proprietary",
      "unknown"
    ]);
  });
});

describe("LICENSE_RISK_TIERS", () => {
  it("should map MIT to permissive", () => {
    expect(LICENSE_RISK_TIERS["MIT"]).toBe("permissive");
  });

  it("should map GPL-3.0 to copyleft", () => {
    expect(LICENSE_RISK_TIERS["GPL-3.0"]).toBe("copyleft");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/licenses/__tests__/types.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `src/shared/licenses/types.ts`:

```typescript
export const RISK_TIER_VALUES = [
  "permissive",
  "weak-copyleft",
  "copyleft",
  "proprietary",
  "unknown"
] as const;

export type LicenseRiskTier = (typeof RISK_TIER_VALUES)[number];

export const LICENSE_RISK_TIERS: Record<string, LicenseRiskTier> = {
  MIT: "permissive",
  ISC: "permissive",
  "BSD-2-Clause": "permissive",
  "BSD-3-Clause": "permissive",
  "Apache-2.0": "permissive",
  Unlicense: "permissive",
  "CC0-1.0": "permissive",
  "0BSD": "permissive",
  "LGPL-2.1": "weak-copyleft",
  "LGPL-3.0": "weak-copyleft",
  "MPL-2.0": "weak-copyleft",
  "EPL-1.0": "weak-copyleft",
  "EPL-2.0": "weak-copyleft",
  "GPL-2.0": "copyleft",
  "GPL-3.0": "copyleft",
  "AGPL-3.0": "copyleft"
};

export const LICENSE_POLICY_ACTIONS = ["allow", "warn", "deny"] as const;

export type LicensePolicyAction = (typeof LICENSE_POLICY_ACTIONS)[number];

export function classifyLicenseRiskTier(spdxId: string | null): LicenseRiskTier {
  if (spdxId === null || spdxId === "") {
    return "unknown";
  }
  if (spdxId === "UNLICENSED") {
    return "proprietary";
  }
  return LICENSE_RISK_TIERS[spdxId] ?? "unknown";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/licenses/__tests__/types.test.ts`
Expected: PASS — all assertions green

- [ ] **Step 5: Commit**

```bash
git add src/shared/licenses/types.ts src/shared/licenses/__tests__/types.test.ts
git commit -m "feat(licenses): add shared license types and risk tier mapping"
```

---

### Task 2: Database Schema and Migration

**Files:**

- Modify: `src/api/db/schema.ts` (add three tables)
- Create: `src/api/db/migrations/0006_add_licenses.sql`
- Modify: `src/api/db/migrations/meta/_journal.json` (add entry for 0006)

**Interfaces:**

- Consumes: `LicenseRiskTier`, `LicensePolicyAction` from Task 1
- Produces: `licenses`, `licensePolicyRules`, `licenseViolations` Drizzle table definitions

- [ ] **Step 1: Add table definitions to schema.ts**

Add after the `osvCache` table definition (after line ~240) in `src/api/db/schema.ts`:

```typescript
export const licenses = sqliteTable(
  "licenses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    licenseName: text("license_name").notNull(),
    spdxId: text("spdx_id"),
    source: text("source").notNull(),
    riskTier: text("risk_tier").notNull(),
    licenseUrl: text("license_url"),
    scannedAt: integer("scanned_at").notNull()
  },
  table => ({
    uniqueProjectPackage: unique().on(table.projectId, table.packageName)
  })
);

export const licensePolicyRules = sqliteTable("license_policy_rules", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  licensePattern: text("license_pattern"),
  packagePattern: text("package_pattern"),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull(),
  reason: text("reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const licenseViolations = sqliteTable(
  "license_violations",
  {
    id: text("id").primaryKey(),
    licenseId: text("license_id")
      .notNull()
      .references(() => licenses.id, { onDelete: "cascade" }),
    ruleId: text("rule_id")
      .notNull()
      .references(() => licensePolicyRules.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    action: text("action").notNull(),
    scannedAt: integer("scanned_at").notNull()
  },
  table => ({
    uniqueLicenseRule: unique().on(table.licenseId, table.ruleId)
  })
);
```

- [ ] **Step 2: Create migration SQL**

Create `src/api/db/migrations/0006_add_licenses.sql`:

```sql
CREATE TABLE `licenses` (
    `id` text PRIMARY KEY NOT NULL,
    `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
    `package_name` text NOT NULL,
    `license_name` text NOT NULL,
    `spdx_id` text,
    `source` text NOT NULL,
    `risk_tier` text NOT NULL,
    `license_url` text,
    `scanned_at` integer NOT NULL,
    UNIQUE(`project_id`, `package_name`)
);
--> statement-breakpoint
CREATE TABLE `license_policy_rules` (
    `id` text PRIMARY KEY NOT NULL,
    `action` text NOT NULL,
    `license_pattern` text,
    `package_pattern` text,
    `project_id` text REFERENCES `projects`(`id`) ON DELETE CASCADE,
    `priority` integer NOT NULL,
    `reason` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `license_violations` (
    `id` text PRIMARY KEY NOT NULL,
    `license_id` text NOT NULL REFERENCES `licenses`(`id`) ON DELETE CASCADE,
    `rule_id` text NOT NULL REFERENCES `license_policy_rules`(`id`) ON DELETE CASCADE,
    `project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
    `package_name` text NOT NULL,
    `action` text NOT NULL,
    `scanned_at` integer NOT NULL,
    UNIQUE(`license_id`, `rule_id`)
);
```

- [ ] **Step 3: Add migration to journal**

Add a new entry to `src/api/db/migrations/meta/_journal.json` in the `entries` array:

```json
{
  "idx": 6,
  "version": "6",
  "when": 1786060800000,
  "tag": "0006_add_licenses",
  "breakpoints": true
}
```

- [ ] **Step 4: Verify build passes**

Run: `yarn build`
Expected: clean build, no type errors

- [ ] **Step 5: Verify existing tests still pass**

Run: `yarn test`
Expected: all 1360+ tests pass

- [ ] **Step 6: Commit**

```bash
git add src/api/db/schema.ts src/api/db/migrations/0006_add_licenses.sql src/api/db/migrations/meta/_journal.json
git commit -m "feat(licenses): add licenses, policy rules, and violations DB schema"
```
