# License Compliance Part 2: Backend Services

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build LicenseCheckerService, LicensePolicyService, and LicenseScanJobExecutor with full test coverage.

**Architecture:** Three services following existing DI pattern (abstraction + implementation + `createAbstraction`). LicenseCheckerService wraps `license-checker-rspack` via CommandRunner. LicensePolicyService evaluates rules with glob matching and priority. LicenseScanJobExecutor orchestrates scanning and violation computation.

**Tech Stack:** TypeScript, `license-checker-rspack`, `picomatch` (for glob matching), Drizzle ORM, vitest

## Global Constraints

- Use full words in identifiers — no abbreviations
- Named interfaces only — no inline structural types
- Abstraction and implementation in separate files, separate directories
- Real SQLite in-memory for tests — no DB mocks
- Yarn for package management
- Install `license-checker-rspack` and `picomatch` as dependencies before starting

---

### Task 3a: Test Database Client Helper

**Files:**

- Modify: `src/testing/helpers/createTestDb.ts` (add `createTestDatabaseClient()`)

**Interfaces:**

- Consumes: existing `createTestDb()` returning `LibSQLDatabase`
- Produces: `createTestDatabaseClient(): Promise<DatabaseClient.Interface>` — wraps `createTestDb()` into a proper `DatabaseClient.Interface` so tests never need `as any` or `as DatabaseClient.Interface` casts

- [ ] **Step 1: Add helper function**

In `src/testing/helpers/createTestDb.ts`, add:

```typescript
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

export async function createTestDatabaseClient(): Promise<DatabaseClient.Interface> {
  const db = await createTestDb();
  return { db };
}
```

- [ ] **Step 2: Verify build**

Run: `yarn build`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/testing/helpers/createTestDb.ts
git commit -m "test: add createTestDatabaseClient helper to avoid type casts in tests"
```

---

### Task 3: LicenseCheckerService

**Files:**

- Create: `src/api/services/abstractions/LicenseCheckerService.ts`
- Create: `src/api/services/LicenseCheckerService.ts`
- Create: `src/api/services/__tests__/LicenseCheckerService.test.ts`

**Interfaces:**

- Consumes: `CommandRunner.Interface` from `src/api/services/abstractions/CommandRunner.ts` (method: `run(command: string, args: string[], options?: { cwd?: string; signal?: AbortSignal }): Promise<{ stdout: string; stderr: string; exitCode: number }>`)
- Produces: `LicenseCheckerService.Interface` with `scan(projectPath: string): Promise<LicenseCheckerService.LicenseRecord[]>`, where `LicenseRecord = { packageName: string; licenseName: string; spdxId: string | null; licenseUrl: string | null }`

- [ ] **Step 1: Write the abstraction**

Create `src/api/services/abstractions/LicenseCheckerService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ILicenseRecord {
  packageName: string;
  licenseName: string;
  spdxId: string | null;
  licenseUrl: string | null;
}

export interface ILicenseCheckerService {
  scan(projectPath: string): Promise<ILicenseRecord[]>;
}

export const LicenseCheckerService = createAbstraction<ILicenseCheckerService>(
  "Api/LicenseCheckerService"
);

export namespace LicenseCheckerService {
  export type Interface = ILicenseCheckerService;
  export type LicenseRecord = ILicenseRecord;
}
```

- [ ] **Step 2: Write failing tests**

Create `src/api/services/__tests__/LicenseCheckerService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandRunner } from "#api/services/abstractions/CommandRunner.js";

const createMockCommandRunner = (): CommandRunner.Interface => ({
  run: vi.fn(),
  runStreaming: vi.fn()
});

async function createService(commandRunner: CommandRunner.Interface) {
  const { LicenseCheckerServiceImpl } = await import("#api/services/LicenseCheckerService.js");
  return new LicenseCheckerServiceImpl(commandRunner);
}

describe("LicenseCheckerService", () => {
  let commandRunner: CommandRunner.Interface;

  beforeEach(() => {
    commandRunner = createMockCommandRunner();
  });

  it("should parse license-checker-rspack JSON output", async () => {
    const output = JSON.stringify({
      "lodash@4.17.21": {
        licenses: "MIT",
        licenseFile: "/path/to/LICENSE",
        repository: "https://github.com/lodash/lodash"
      },
      "express@4.18.2": {
        licenses: "MIT",
        licenseFile: "/path/to/LICENSE"
      }
    });
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: output,
      stderr: "",
      exitCode: 0
    });

    const service = await createService(commandRunner);
    const results = await service.scan("/test/path");

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      packageName: "lodash",
      licenseName: "MIT",
      spdxId: "MIT",
      licenseUrl: null
    });
    expect(results[1]).toEqual({
      packageName: "express",
      licenseName: "MIT",
      spdxId: "MIT",
      licenseUrl: null
    });
  });

  it("should handle dual licenses (OR expression)", async () => {
    const output = JSON.stringify({
      "some-pkg@1.0.0": {
        licenses: "(MIT OR Apache-2.0)",
        licenseFile: "/path/to/LICENSE"
      }
    });
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: output,
      stderr: "",
      exitCode: 0
    });

    const service = await createService(commandRunner);
    const results = await service.scan("/test/path");

    expect(results[0]!.licenseName).toBe("(MIT OR Apache-2.0)");
    expect(results[0]!.spdxId).toBe("(MIT OR Apache-2.0)");
  });

  it("should handle UNLICENSED", async () => {
    const output = JSON.stringify({
      "private-pkg@1.0.0": {
        licenses: "UNLICENSED"
      }
    });
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: output,
      stderr: "",
      exitCode: 0
    });

    const service = await createService(commandRunner);
    const results = await service.scan("/test/path");

    expect(results[0]!.licenseName).toBe("UNLICENSED");
    expect(results[0]!.spdxId).toBe("UNLICENSED");
  });

  it("should handle missing license field", async () => {
    const output = JSON.stringify({
      "mystery-pkg@1.0.0": {}
    });
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: output,
      stderr: "",
      exitCode: 0
    });

    const service = await createService(commandRunner);
    const results = await service.scan("/test/path");

    expect(results[0]!.licenseName).toBe("UNKNOWN");
    expect(results[0]!.spdxId).toBeNull();
  });

  it("should return empty array when command fails", async () => {
    vi.mocked(commandRunner.run).mockRejectedValue(new Error("command not found"));

    const service = await createService(commandRunner);
    const results = await service.scan("/test/path");

    expect(results).toEqual([]);
  });

  it("should return empty array for invalid JSON output", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: "not json",
      stderr: "",
      exitCode: 0
    });

    const service = await createService(commandRunner);
    const results = await service.scan("/test/path");

    expect(results).toEqual([]);
  });

  it("should extract license URL from repository field", async () => {
    const output = JSON.stringify({
      "pkg@1.0.0": {
        licenses: "MIT",
        repository: "https://github.com/owner/repo"
      }
    });
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: output,
      stderr: "",
      exitCode: 0
    });

    const service = await createService(commandRunner);
    const results = await service.scan("/test/path");

    expect(results[0]!.licenseUrl).toBe("https://github.com/owner/repo");
  });

  it("should call license-checker-rspack with --json flag and correct cwd", async () => {
    vi.mocked(commandRunner.run).mockResolvedValue({
      stdout: "{}",
      stderr: "",
      exitCode: 0
    });

    const service = await createService(commandRunner);
    await service.scan("/my/project");

    expect(commandRunner.run).toHaveBeenCalledWith(
      "npx",
      ["license-checker-rspack", "--json"],
      expect.objectContaining({ cwd: "/my/project" })
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/LicenseCheckerService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write implementation**

Create `src/api/services/LicenseCheckerService.ts`:

```typescript
import { LicenseCheckerService as Abstraction } from "./abstractions/LicenseCheckerService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";

interface ILicenseCheckerEntry {
  licenses?: string;
  repository?: string;
  licenseFile?: string;
}

type LicenseCheckerOutput = Record<string, ILicenseCheckerEntry>;

function parsePackageName(key: string): string {
  const atIndex = key.lastIndexOf("@");
  if (atIndex <= 0) {
    return key;
  }
  return key.slice(0, atIndex);
}

export class LicenseCheckerServiceImpl implements Abstraction.Interface {
  public constructor(private readonly commandRunner: CommandRunner.Interface) {}

  public async scan(projectPath: string): Promise<Abstraction.LicenseRecord[]> {
    let stdout: string;
    try {
      const result = await this.commandRunner.run("npx", ["license-checker-rspack", "--json"], {
        cwd: projectPath
      });
      stdout = result.stdout;
    } catch {
      return [];
    }

    let parsed: LicenseCheckerOutput;
    try {
      parsed = JSON.parse(stdout) as LicenseCheckerOutput;
    } catch {
      return [];
    }

    const records: Abstraction.LicenseRecord[] = [];

    for (const [key, entry] of Object.entries(parsed)) {
      const packageName = parsePackageName(key);
      const licenseName = entry.licenses ?? "UNKNOWN";
      const spdxId = licenseName === "UNKNOWN" ? null : licenseName;
      const licenseUrl = entry.repository ?? null;

      records.push({ packageName, licenseName, spdxId, licenseUrl });
    }

    return records;
  }
}

export const LicenseCheckerService = Abstraction.createImplementation({
  implementation: LicenseCheckerServiceImpl,
  dependencies: [CommandRunner]
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test src/api/services/__tests__/LicenseCheckerService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/abstractions/LicenseCheckerService.ts src/api/services/LicenseCheckerService.ts src/api/services/__tests__/LicenseCheckerService.test.ts
git commit -m "feat(licenses): add LicenseCheckerService with license-checker-rspack integration"
```

---

### Task 4: LicensePolicyService

**Files:**

- Create: `src/api/services/abstractions/LicensePolicyService.ts`
- Create: `src/api/services/LicensePolicyService.ts`
- Create: `src/api/services/__tests__/LicensePolicyService.test.ts`

**Interfaces:**

- Consumes: `DatabaseClient.Interface` from `src/api/db/abstractions/DatabaseClient.ts`, `licensePolicyRules` and `licenseViolations` tables from `src/api/db/schema.ts`, `picomatch` for glob matching
- Produces: `LicensePolicyService.Interface` with:
  - `evaluate(projectId: string, licenses: Array<{ id: string; packageName: string; spdxId: string | null; licenseName: string }>): Promise<LicensePolicyService.Violation[]>`
  - `getComplianceStatus(projectId: string): Promise<LicensePolicyService.ComplianceStatus>`
  - `Violation = { licenseId: string; ruleId: string; projectId: string; packageName: string; action: "warn" | "deny" }`
  - `ComplianceStatus = { total: number; allowed: number; warned: number; denied: number }`

- [ ] **Step 1: Install picomatch**

Run: `yarn add picomatch` and `yarn add -D @types/picomatch`

- [ ] **Step 2: Write the abstraction**

Create `src/api/services/abstractions/LicensePolicyService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";

export interface ILicenseInput {
  id: string;
  packageName: string;
  spdxId: string | null;
  licenseName: string;
}

export interface ILicenseViolation {
  licenseId: string;
  ruleId: string;
  projectId: string;
  packageName: string;
  action: Exclude<LicensePolicyAction, "allow">;
}

export interface IComplianceStatus {
  total: number;
  allowed: number;
  warned: number;
  denied: number;
}

export interface ILicensePolicyService {
  evaluate(projectId: string, licenses: ILicenseInput[]): Promise<ILicenseViolation[]>;
  getComplianceStatus(projectId: string): Promise<IComplianceStatus>;
}

export const LicensePolicyService = createAbstraction<ILicensePolicyService>(
  "Api/LicensePolicyService"
);

export namespace LicensePolicyService {
  export type Interface = ILicensePolicyService;
  export type LicenseInput = ILicenseInput;
  export type Violation = ILicenseViolation;
  export type ComplianceStatus = IComplianceStatus;
}
```

- [ ] **Step 3: Write failing tests**

Create `src/api/services/__tests__/LicensePolicyService.test.ts`. Tests must cover:

1. No rules → no violations (default allow)
2. Global "deny GPL-*" rule matches GPL-2.0 and GPL-3.0
3. Global "allow MIT" rule → no violation for MIT
4. Project-scoped rule overrides global at same priority
5. Higher priority rule wins over lower
6. Package-specific exemption: "allow GPL-2.0 for package linux-headers"
7. Null licensePattern matches any license
8. Null packagePattern matches any package
9. `getComplianceStatus()` returns correct counts
10. OR license expression: "(MIT OR GPL-3.0)" — each component evaluated independently, most permissive wins

Test structure: create real in-memory SQLite DB with schema, insert rules, call `evaluate()`, assert violations.

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { licensePolicyRules, licenses, licenseViolations, projects } from "#api/db/schema.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { LicensePolicyService } from "#api/services/abstractions/LicensePolicyService.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";

async function createService(databaseClient: DatabaseClient.Interface) {
  const { LicensePolicyServiceImpl } = await import("#api/services/LicensePolicyService.js");
  return new LicensePolicyServiceImpl(databaseClient);
}

function createLicenseInput(
  packageName: string,
  spdxId: string | null,
  licenseName?: string
): LicensePolicyService.LicenseInput {
  return {
    id: generateId(),
    packageName,
    spdxId,
    licenseName: licenseName ?? spdxId ?? "UNKNOWN"
  };
}

describe("LicensePolicyService", () => {
  let databaseClient: DatabaseClient.Interface;
  const projectId = "project-1";

  beforeEach(async () => {
    databaseClient = await createTestDatabaseClient();
    await databaseClient.db
      .insert(projects)
      .values({
        id: projectId,
        name: "Test Project",
        path: "/test",
        addedAt: Date.now()
      })
      .run();
  });

  it("should return no violations when no rules exist", async () => {
    const service = await createService(databaseClient);
    const input = [createLicenseInput("lodash", "MIT")];
    const violations = await service.evaluate(projectId, input);
    expect(violations).toEqual([]);
  });

  it("should match a global deny rule with glob pattern", async () => {
    databaseClient.db
      .insert(licensePolicyRules)
      .values({
        id: generateId(),
        action: "deny",
        licensePattern: "GPL-*",
        packagePattern: null,
        projectId: null,
        priority: 10,
        reason: "No copyleft",
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();

    const service = await createService(databaseClient);
    const input = [createLicenseInput("gpl-pkg", "GPL-3.0"), createLicenseInput("mit-pkg", "MIT")];
    const violations = await service.evaluate(projectId, input);

    expect(violations).toHaveLength(1);
    expect(violations[0]!.packageName).toBe("gpl-pkg");
    expect(violations[0]!.action).toBe("deny");
  });

  it("should respect project-scoped rule over global at same priority", async () => {
    const now = Date.now();
    databaseClient.db
      .insert(licensePolicyRules)
      .values([
        {
          id: generateId(),
          action: "deny",
          licensePattern: "GPL-2.0",
          packagePattern: null,
          projectId: null,
          priority: 10,
          reason: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: generateId(),
          action: "allow",
          licensePattern: "GPL-2.0",
          packagePattern: null,
          projectId: projectId,
          priority: 10,
          reason: "Allowed in this project",
          createdAt: now,
          updatedAt: now
        }
      ])
      .run();

    const service = await createService(databaseClient);
    const input = [createLicenseInput("gpl-pkg", "GPL-2.0")];
    const violations = await service.evaluate(projectId, input);

    expect(violations).toEqual([]);
  });

  it("should let higher priority rule win", async () => {
    const now = Date.now();
    databaseClient.db
      .insert(licensePolicyRules)
      .values([
        {
          id: generateId(),
          action: "deny",
          licensePattern: "MIT",
          packagePattern: null,
          projectId: null,
          priority: 5,
          reason: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: generateId(),
          action: "allow",
          licensePattern: "MIT",
          packagePattern: null,
          projectId: null,
          priority: 20,
          reason: null,
          createdAt: now,
          updatedAt: now
        }
      ])
      .run();

    const service = await createService(databaseClient);
    const input = [createLicenseInput("mit-pkg", "MIT")];
    const violations = await service.evaluate(projectId, input);

    expect(violations).toEqual([]);
  });

  it("should support package-specific exemption", async () => {
    const now = Date.now();
    databaseClient.db
      .insert(licensePolicyRules)
      .values([
        {
          id: generateId(),
          action: "deny",
          licensePattern: "GPL-2.0",
          packagePattern: null,
          projectId: null,
          priority: 10,
          reason: null,
          createdAt: now,
          updatedAt: now
        },
        {
          id: generateId(),
          action: "allow",
          licensePattern: "GPL-2.0",
          packagePattern: "linux-headers",
          projectId: null,
          priority: 20,
          reason: "Exemption",
          createdAt: now,
          updatedAt: now
        }
      ])
      .run();

    const service = await createService(databaseClient);
    const input = [
      createLicenseInput("linux-headers", "GPL-2.0"),
      createLicenseInput("other-gpl-pkg", "GPL-2.0")
    ];
    const violations = await service.evaluate(projectId, input);

    expect(violations).toHaveLength(1);
    expect(violations[0]!.packageName).toBe("other-gpl-pkg");
  });

  it("should generate warn violations", async () => {
    databaseClient.db
      .insert(licensePolicyRules)
      .values({
        id: generateId(),
        action: "warn",
        licensePattern: "LGPL-*",
        packagePattern: null,
        projectId: null,
        priority: 10,
        reason: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();

    const service = await createService(databaseClient);
    const input = [createLicenseInput("lgpl-pkg", "LGPL-3.0")];
    const violations = await service.evaluate(projectId, input);

    expect(violations).toHaveLength(1);
    expect(violations[0]!.action).toBe("warn");
  });

  it("should handle OR license expression — most permissive wins", async () => {
    databaseClient.db
      .insert(licensePolicyRules)
      .values({
        id: generateId(),
        action: "deny",
        licensePattern: "GPL-3.0",
        packagePattern: null,
        projectId: null,
        priority: 10,
        reason: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      .run();

    const service = await createService(databaseClient);
    const input = [createLicenseInput("dual-pkg", "(MIT OR GPL-3.0)", "(MIT OR GPL-3.0)")];
    const violations = await service.evaluate(projectId, input);

    expect(violations).toEqual([]);
  });

  it("should return correct compliance status", async () => {
    const now = Date.now();
    databaseClient.db
      .insert(licensePolicyRules)
      .values({
        id: generateId(),
        action: "deny",
        licensePattern: "GPL-*",
        packagePattern: null,
        projectId: null,
        priority: 10,
        reason: null,
        createdAt: now,
        updatedAt: now
      })
      .run();

    const licenseIds = [generateId(), generateId(), generateId()];
    databaseClient.db
      .insert(licenses)
      .values([
        {
          id: licenseIds[0]!,
          projectId,
          packageName: "mit-pkg",
          licenseName: "MIT",
          spdxId: "MIT",
          source: "license-checker",
          riskTier: "permissive",
          scannedAt: now
        },
        {
          id: licenseIds[1]!,
          projectId,
          packageName: "gpl-pkg",
          licenseName: "GPL-3.0",
          spdxId: "GPL-3.0",
          source: "license-checker",
          riskTier: "copyleft",
          scannedAt: now
        },
        {
          id: licenseIds[2]!,
          projectId,
          packageName: "isc-pkg",
          licenseName: "ISC",
          spdxId: "ISC",
          source: "license-checker",
          riskTier: "permissive",
          scannedAt: now
        }
      ])
      .run();

    const service = await createService(databaseClient);
    const input = [
      { id: licenseIds[0]!, packageName: "mit-pkg", spdxId: "MIT", licenseName: "MIT" },
      { id: licenseIds[1]!, packageName: "gpl-pkg", spdxId: "GPL-3.0", licenseName: "GPL-3.0" },
      { id: licenseIds[2]!, packageName: "isc-pkg", spdxId: "ISC", licenseName: "ISC" }
    ];
    await service.evaluate(projectId, input);

    const status = await service.getComplianceStatus(projectId);
    expect(status.total).toBe(3);
    expect(status.denied).toBe(1);
    expect(status.allowed).toBe(2);
    expect(status.warned).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/LicensePolicyService.test.ts`
Expected: FAIL

- [ ] **Step 5: Write implementation**

Create `src/api/services/LicensePolicyService.ts`:

```typescript
import picomatch from "picomatch";
import { and, eq, isNull, or } from "drizzle-orm";
import { LicensePolicyService as Abstraction } from "./abstractions/LicensePolicyService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { licensePolicyRules, licenses, licenseViolations } from "#api/db/schema.js";

function matchesGlob(value: string, pattern: string): boolean {
  return picomatch(pattern)(value);
}

function extractOrComponents(spdxId: string): string[] {
  const cleaned = spdxId.replace(/^\(/, "").replace(/\)$/, "");
  return cleaned
    .split(/\s+OR\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

interface IMatchedRule {
  id: string;
  action: "allow" | "warn" | "deny";
  priority: number;
  isProjectScoped: boolean;
}

class LicensePolicyServiceImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async evaluate(
    projectId: string,
    licenseInputs: Abstraction.LicenseInput[]
  ): Promise<Abstraction.Violation[]> {
    const rules = await this.databaseClient.db
      .select()
      .from(licensePolicyRules)
      .where(or(isNull(licensePolicyRules.projectId), eq(licensePolicyRules.projectId, projectId)))
      .all();

    if (rules.length === 0) {
      return [];
    }

    const violations: Abstraction.Violation[] = [];

    for (const license of licenseInputs) {
      const violation = this.evaluateSingleLicense(projectId, license, rules);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  private evaluateSingleLicense(
    projectId: string,
    license: Abstraction.LicenseInput,
    rules: Array<typeof licensePolicyRules.$inferSelect>
  ): Abstraction.Violation | null {
    const spdxId = license.spdxId ?? license.licenseName;
    const isOrExpression = spdxId.includes(" OR ");
    const components = isOrExpression ? extractOrComponents(spdxId) : [spdxId];

    const componentResults = components.map(component =>
      this.findBestMatch(component, license.packageName, rules)
    );

    if (isOrExpression) {
      const hasAllow = componentResults.some(r => r === null || r.action === "allow");
      if (hasAllow) {
        return null;
      }
    }

    const bestMatch = componentResults.find(r => r !== null) ?? null;

    if (bestMatch === null || bestMatch.action === "allow") {
      return null;
    }

    return {
      licenseId: license.id,
      ruleId: bestMatch.id,
      projectId,
      packageName: license.packageName,
      action: bestMatch.action as Exclude<"allow", string> & ("warn" | "deny")
    };
  }

  private findBestMatch(
    spdxComponent: string,
    packageName: string,
    rules: Array<typeof licensePolicyRules.$inferSelect>
  ): IMatchedRule | null {
    const matching: IMatchedRule[] = [];

    for (const rule of rules) {
      const licenseMatches =
        rule.licensePattern === null || matchesGlob(spdxComponent, rule.licensePattern);
      const packageMatches =
        rule.packagePattern === null || matchesGlob(packageName, rule.packagePattern);

      if (licenseMatches && packageMatches) {
        matching.push({
          id: rule.id,
          action: rule.action as "allow" | "warn" | "deny",
          priority: rule.priority,
          isProjectScoped: rule.projectId !== null
        });
      }
    }

    if (matching.length === 0) {
      return null;
    }

    matching.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return (b.isProjectScoped ? 1 : 0) - (a.isProjectScoped ? 1 : 0);
    });

    return matching[0]!;
  }

  public async getComplianceStatus(projectId: string): Promise<Abstraction.ComplianceStatus> {
    const allLicenses = await this.databaseClient.db
      .select()
      .from(licenses)
      .where(eq(licenses.projectId, projectId))
      .all();

    const allViolations = await this.databaseClient.db
      .select()
      .from(licenseViolations)
      .where(eq(licenseViolations.projectId, projectId))
      .all();

    const warned = allViolations.filter(v => v.action === "warn").length;
    const denied = allViolations.filter(v => v.action === "deny").length;

    return {
      total: allLicenses.length,
      allowed: allLicenses.length - warned - denied,
      warned,
      denied
    };
  }
}

export const LicensePolicyService = Abstraction.createImplementation({
  implementation: LicensePolicyServiceImpl,
  dependencies: [DatabaseClient]
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test src/api/services/__tests__/LicensePolicyService.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/services/abstractions/LicensePolicyService.ts src/api/services/LicensePolicyService.ts src/api/services/__tests__/LicensePolicyService.test.ts
git commit -m "feat(licenses): add LicensePolicyService with glob matching and priority rules"
```

---

### Task 5: LicenseScanJobExecutor, WebSocket Events, and Job Registration

**Files:**

- Create: `src/api/services/jobExecutors/LicenseScanJobExecutor.ts`
- Modify: `src/api/services/jobExecutors/JobExecutorRegistry.ts` (register new executor + add dependencies)
- Modify: `src/api/services/abstractions/JobWorker.ts` (add `"license-scan"` to type union)
- Modify: `src/shared/websocket/types.ts` (add license-scan events)
- Modify: `src/api/server.ts` (add `scan:completed` → license-scan enqueue listener)
- Create: `src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts`

**Interfaces:**

- Consumes: `LicenseCheckerService.Interface` (Task 3), `LicensePolicyService.Interface` (Task 4), `DatabaseClient.Interface`, `WebSocketBroadcaster.Interface`, `ErrorReporter.Interface`, `classifyLicenseRiskTier()` from Task 1, `licenses` table from Task 2
- Produces: `LicenseScanJobExecutor` with `type = "license-scan"` and `execute(context: JobExecutor.ExecutionContext): Promise<void>`

- [ ] **Step 1: Add "license-scan" to ICreateJobInput type union**

In `src/api/services/abstractions/JobWorker.ts`, add `"license-scan"` to the `type` union in `ICreateJobInput`:

```typescript
type:
    | "dependency"
    | "transient"
    | "packageManager"
    | "scan"
    | "clone"
    | "install"
    | "changelog"
    | "license-scan";
```

- [ ] **Step 2: Add WebSocket event types**

In `src/shared/websocket/types.ts`, add the license-scan event interfaces and register them in `WSEventMap`:

```typescript
export interface WSLicenseScanProgress {
  projectId: string;
  packageName: string;
  current: number;
  total: number;
}

export interface WSLicenseScanComplete {
  projectId: string;
  totalLicenses: number;
  violations: number;
}
```

Add to `WSEventMap`:

```typescript
"license-scan:progress": WSLicenseScanProgress;
"license-scan:complete": WSLicenseScanComplete;
```

- [ ] **Step 3: Add EventBus event type augmentation**

In `src/api/services/jobExecutors/LicenseScanJobExecutor.ts`, add module augmentation at the top (same pattern as `ScanSchedulerService.ts`):

```typescript
declare module "../abstractions/EventBus.js" {
  interface IEventMap {
    "license-scan:completed": [projectId: string];
  }
}
```

- [ ] **Step 4: Write the LicenseScanJobExecutor**

Create `src/api/services/jobExecutors/LicenseScanJobExecutor.ts`:

```typescript
import { eq, lt, and } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { JobExecutor } from "./abstractions/JobExecutor.js";
import type { LicenseCheckerService } from "../abstractions/LicenseCheckerService.js";
import type { LicensePolicyService } from "../abstractions/LicensePolicyService.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import type { ErrorReporter } from "../abstractions/ErrorReporter.js";
import { licenses, licenseViolations, scanResults } from "#api/db/schema.js";
import { classifyLicenseRiskTier } from "#shared/licenses/types.js";

declare module "../abstractions/EventBus.js" {
  interface IEventMap {
    "license-scan:completed": [projectId: string];
  }
}

export class LicenseScanJobExecutor implements JobExecutor.Interface {
  public readonly type = "license-scan";

  public constructor(
    private readonly licenseCheckerService: LicenseCheckerService.Interface,
    private readonly licensePolicyService: LicensePolicyService.Interface,
    private readonly databaseClient: DatabaseClient.Interface,
    private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface,
    private readonly errorReporter: ErrorReporter.Interface
  ) {}

  public async execute(context: JobExecutor.ExecutionContext): Promise<void> {
    const projectId = context.referenceId;
    const scannedAt = Date.now();

    const checkerRecords = await this.licenseCheckerService.scan(context.projectPath);
    const usedFallback = checkerRecords.length === 0;

    let records = checkerRecords;
    if (usedFallback) {
      const scanRows = await this.databaseClient.db
        .select({ name: scanResults.name })
        .from(scanResults)
        .where(eq(scanResults.projectId, projectId))
        .all();

      records = scanRows.map(row => ({
        packageName: row.name,
        licenseName: "UNKNOWN",
        spdxId: null,
        licenseUrl: null
      }));
    }

    const licenseRows = records.map(record => ({
      id: generateId(),
      projectId,
      packageName: record.packageName,
      licenseName: record.licenseName,
      spdxId: record.spdxId,
      source: usedFallback ? ("registry" as const) : ("license-checker" as const),
      riskTier: classifyLicenseRiskTier(record.spdxId),
      licenseUrl: record.licenseUrl,
      scannedAt
    }));

    await this.databaseClient.db.transaction(async tx => {
      for (const row of licenseRows) {
        await tx
          .insert(licenses)
          .values(row)
          .onConflictDoUpdate({
            target: [licenses.projectId, licenses.packageName],
            set: {
              licenseName: row.licenseName,
              spdxId: row.spdxId,
              source: row.source,
              riskTier: row.riskTier,
              licenseUrl: row.licenseUrl,
              scannedAt: row.scannedAt
            }
          })
          .run();
      }
      await tx
        .delete(licenses)
        .where(and(eq(licenses.projectId, projectId), lt(licenses.scannedAt, scannedAt)))
        .run();
    });

    await this.databaseClient.db
      .delete(licenseViolations)
      .where(eq(licenseViolations.projectId, projectId))
      .run();

    const licenseInputs = licenseRows.map(row => ({
      id: row.id,
      packageName: row.packageName,
      spdxId: row.spdxId,
      licenseName: row.licenseName
    }));

    const violations = await this.licensePolicyService.evaluate(projectId, licenseInputs);

    for (const violation of violations) {
      await this.databaseClient.db
        .insert(licenseViolations)
        .values({
          id: generateId(),
          licenseId: violation.licenseId,
          ruleId: violation.ruleId,
          projectId: violation.projectId,
          packageName: violation.packageName,
          action: violation.action,
          scannedAt
        })
        .onConflictDoNothing()
        .run();
    }

    this.webSocketBroadcaster.broadcast("license-scan:complete", {
      projectId,
      totalLicenses: licenseRows.length,
      violations: violations.length
    });
  }
}
```

- [ ] **Step 5: Register in JobExecutorRegistry**

In `src/api/services/jobExecutors/JobExecutorRegistry.ts`:

1. Add imports for `LicenseCheckerService`, `LicensePolicyService`, and `LicenseScanJobExecutor`
2. Add `LicenseScanJobExecutor` to the `all` array in the constructor
3. Add `LicenseCheckerService` and `LicensePolicyService` to constructor parameters and `dependencies` array

- [ ] **Step 6: Add scan:completed listener in server.ts**

In `src/api/server.ts`, after the existing `scan:scheduled` listener (around line 123), add:

```typescript
eventBus.on("scan:completed", (projectId: string) => {
  void jobWorker.enqueue({
    referenceId: projectId,
    referenceType: "project",
    type: "license-scan"
  });
});
```

- [ ] **Step 7: Write tests for LicenseScanJobExecutor**

Create `src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts` with tests covering:

1. Happy path — checker returns records, no rules, licenses persisted, no violations
2. Checker fails — falls back to scanResults package names with UNKNOWN license
3. Stale licenses deleted after rescan
4. Violations generated when deny rule matches
5. WebSocket broadcast called with correct counts

- [ ] **Step 8: Run all tests**

Run: `yarn test`
Expected: all tests pass including new ones

- [ ] **Step 9: Commit**

```bash
git add src/api/services/jobExecutors/LicenseScanJobExecutor.ts src/api/services/jobExecutors/JobExecutorRegistry.ts src/api/services/abstractions/JobWorker.ts src/shared/websocket/types.ts src/api/server.ts src/api/services/jobExecutors/__tests__/LicenseScanJobExecutor.test.ts
git commit -m "feat(licenses): add LicenseScanJobExecutor with job registration and auto-chain"
```
