# CLI Integration Tests, IPackageEntry Consolidation, CSV Edge Cases

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add E2E integration tests for the CLI scan pipeline, consolidate the duplicated IPackageEntry interface, and fix/test CSV escapeValue edge cases.

**Architecture:** Three independent tasks with no ordering dependency. Task 2 (IPackageEntry consolidation) creates a shared type that Task 1 (integration tests) will import, so Task 2 should run first. Task 3 (CSV) is fully independent.

**Tech Stack:** TypeScript, Vitest, @webiny/di

## Global Constraints

- Use `yarn full` to verify (lint, format, build, tests)
- Named interfaces only, no inline structural types
- Object params with named keys for 2+ params
- Full words in identifiers (no abbreviations)
- Format with `yarn format:fix` and `yarn lint:fix` before commit

---

### Task 1: IPackageEntry Consolidation

**Files:**

- Create: `src/shared/types/IPackageEntry.ts`
- Modify: `src/shared/vulnerabilities/abstractions/VulnerabilityMerger.ts:5-8,24-28`
- Modify: `src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts:7-10`
- Modify: `src/cli/commands/scan/steps/ParseLockfile/ParseLockfileStep.ts:5-8`
- Modify: `src/cli/commands/scan/steps/CheckVulnerabilities/CheckVulnerabilitiesStep.ts:7`
- Modify: `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts:5`
- Modify: `src/api/services/Vulnerability/VulnerabilityService.ts:14`

**Interfaces:**

- Produces: `IPackageEntry { name: string; version: string }` exported from `src/shared/types/IPackageEntry.ts`

- [ ] **Step 1: Create shared IPackageEntry file**

Create `src/shared/types/IPackageEntry.ts`:

```typescript
export interface IPackageEntry {
  name: string;
  version: string;
}
```

- [ ] **Step 2: Update VulnerabilityMerger to import from shared types**

In `src/shared/vulnerabilities/abstractions/VulnerabilityMerger.ts`:

- Remove the local `IPackageEntry` interface (lines 5-8)
- Add import: `import type { IPackageEntry } from "../../types/IPackageEntry.js";`
- Keep the re-export in the namespace (line 27: `export type PackageEntry = IPackageEntry;`)
- Keep the `export { IPackageEntry }` so existing consumers that import from this file still work — add: `export type { IPackageEntry };`

After edit, file should look like:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IAuditRecord, IMergedVulnerability } from "../types.js";
import type { IOsvAdvisory } from "./OsvQueryService.js";
import type { IPackageEntry } from "../../types/IPackageEntry.js";

export type { IPackageEntry };

export interface IVulnerabilityMergerInput {
  auditRecords: IAuditRecord[];
  osvAdvisories: Map<string, IOsvAdvisory[]>;
  packages: IPackageEntry[];
}

export interface IVulnerabilityMerger {
  merge(input: IVulnerabilityMergerInput): IMergedVulnerability[];
}

export const VulnerabilityMerger = createAbstraction<IVulnerabilityMerger>(
  "Shared/VulnerabilityMerger"
);

export namespace VulnerabilityMerger {
  export type Interface = IVulnerabilityMerger;
  export type Input = IVulnerabilityMergerInput;
  export type PackageEntry = IPackageEntry;
}
```

- [ ] **Step 3: Remove local IPackageEntry from CheckLicensesStep**

In `src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts`:

- Delete lines 7-10 (local `interface IPackageEntry { name: string; version: string; }`)
- Add import: `import type { IPackageEntry } from "#shared/types/IPackageEntry.js";`

- [ ] **Step 4: Remove local IPackageEntry from ParseLockfileStep**

In `src/cli/commands/scan/steps/ParseLockfile/ParseLockfileStep.ts`:

- Delete lines 5-8 (local `interface IPackageEntry { name: string; version: string; }`)
- Add import: `import type { IPackageEntry } from "#shared/types/IPackageEntry.js";`

- [ ] **Step 5: Verify existing imports still work**

Files that already import `IPackageEntry` from VulnerabilityMerger should still compile:

- `src/cli/commands/scan/steps/CheckVulnerabilities/CheckVulnerabilitiesStep.ts:7` — imports from `#shared/vulnerabilities/abstractions/VulnerabilityMerger.js`
- `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts:5` — imports from `#shared/vulnerabilities/abstractions/VulnerabilityMerger.js`
- `src/api/services/Vulnerability/VulnerabilityService.ts:14` — imports from `#shared/vulnerabilities/abstractions/VulnerabilityMerger.js`

These files keep their existing import path because VulnerabilityMerger re-exports `IPackageEntry`. No changes needed.

Run: `yarn full`
Expected: All lint, format, build, and tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/IPackageEntry.ts src/shared/vulnerabilities/abstractions/VulnerabilityMerger.ts src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts src/cli/commands/scan/steps/ParseLockfile/ParseLockfileStep.ts
git commit -m "refactor: consolidate IPackageEntry into shared types"
```

---

### Task 2: CSV escapeValue Edge Cases

**Files:**

- Modify: `src/cli/commands/scan/formatters/CsvFormatter.ts:56-61`
- Modify: `src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`

**Interfaces:**

- Consumes: `CsvFormatter.format(output: IScanOutput): string` (existing)
- Produces: No new public interfaces

- [ ] **Step 1: Write failing test for bare `\r`**

Add to `src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`:

```typescript
it("escapes bare carriage return in values", () => {
  const output = createTestOutput();
  output.findings.license = [
    {
      packageName: "pkg\rwith\rcr",
      version: "1.0.0",
      license: "MIT",
      riskTier: "permissive"
    }
  ];

  const result = formatter.format(output);
  expect(result).toContain('"pkg\rwith\rcr"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`
Expected: FAIL — bare `\r` not detected, value appears unquoted.

- [ ] **Step 3: Fix escapeValue to handle `\r`**

In `src/cli/commands/scan/formatters/CsvFormatter.ts`, change line 57 from:

```typescript
if (value.includes(",") || value.includes('"') || value.includes("\n")) {
```

to:

```typescript
if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`
Expected: PASS

- [ ] **Step 5: Write remaining edge case tests**

Add these tests to `src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`:

```typescript
it("doubles quotes inside quoted values", () => {
  const output = createTestOutput();
  output.findings.license = [
    {
      packageName: 'He said "hello"',
      version: "1.0.0",
      license: "MIT",
      riskTier: "permissive"
    }
  ];

  const result = formatter.format(output);
  expect(result).toContain('"He said ""hello"""');
});

it("escapes newline in values", () => {
  const output = createTestOutput();
  output.findings.license = [
    {
      packageName: "line1\nline2",
      version: "1.0.0",
      license: "MIT",
      riskTier: "permissive"
    }
  ];

  const result = formatter.format(output);
  expect(result).toContain('"line1\nline2"');
});

it("escapes values with combined special characters", () => {
  const output = createTestOutput();
  output.findings.license = [
    {
      packageName: 'has,comma "and" quote\nnewline',
      version: "1.0.0",
      license: "MIT",
      riskTier: "permissive"
    }
  ];

  const result = formatter.format(output);
  expect(result).toContain('"has,comma ""and"" quote\nnewline"');
});

it("passes through empty string unchanged", () => {
  const output = createTestOutput();
  output.findings.vulnerability = [
    {
      packageName: "pkg",
      installedVersion: "1.0.0",
      severity: "low",
      title: "minor issue",
      advisoryUrl: null,
      cveId: null,
      dedupKey: "hash",
      vulnerableRange: null,
      fixVersion: null,
      source: "audit"
    }
  ];

  const result = formatter.format(output);
  const lines = result.split("\n");
  const vulnLine = lines.find(line => line.startsWith("vulnerability,"));
  // fixVersion is null -> "" and source "audit" are both present, no wrapping quotes around empty
  expect(vulnLine).toBe("vulnerability,pkg,1.0.0,hash,low,audit,");
});

it("escapes CRLF in values", () => {
  const output = createTestOutput();
  output.findings.license = [
    {
      packageName: "line1\r\nline2",
      version: "1.0.0",
      license: "MIT",
      riskTier: "permissive"
    }
  ];

  const result = formatter.format(output);
  expect(result).toContain('"line1\r\nline2"');
});
```

- [ ] **Step 6: Run all CSV tests**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/scan/formatters/CsvFormatter.ts src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts
git commit -m "fix: handle bare carriage return in CSV escapeValue, add edge case tests"
```

---

### Task 3: E2E CLI Scan Pipeline Integration Tests

**Files:**

- Create: `src/cli/commands/scan/__tests__/fixtures/yarn.lock`
- Create: `src/cli/commands/scan/__tests__/fixtures/depco.config.ts`
- Create: `src/cli/commands/scan/__tests__/ScanPipeline.integration.test.ts`

**Interfaces:**

- Consumes: `ScanCommandFeature` (feature compositor), `ScanCommand` (abstraction token), `StepRunner` (abstraction token), `StepRunnerFeature`, `createContainer()`, `registerFeatures(container, features)`
- Consumes: `LockfileParserService` (abstraction token — mock override via `registerInstance`)
- Consumes: `IPackageEntry` from `src/shared/types/IPackageEntry.ts` (from Task 1)
- Consumes: `IDependencyEdge` from `src/api/services/DependencyGraph/abstractions/LockfileParserService.ts`
- Produces: No new public interfaces

- [ ] **Step 1: Create fixture yarn.lock**

Create `src/cli/commands/scan/__tests__/fixtures/yarn.lock` with 5 packages:

```
# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1


express@^4.18.0:
  version "4.18.2"
  resolved "https://registry.yarnpkg.com/express/-/express-4.18.2.tgz"
  integrity sha512-abc123

lodash@^4.17.21:
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"
  integrity sha512-def456

left-pad@^1.3.0:
  version "1.3.0"
  resolved "https://registry.yarnpkg.com/left-pad/-/left-pad-1.3.0.tgz"
  integrity sha512-ghi789

gpl-licensed@^1.0.0:
  version "1.0.0"
  resolved "https://registry.yarnpkg.com/gpl-licensed/-/gpl-licensed-1.0.0.tgz"
  integrity sha512-jkl012

safe-pkg@^2.0.0:
  version "2.0.0"
  resolved "https://registry.yarnpkg.com/safe-pkg/-/safe-pkg-2.0.0.tgz"
  integrity sha512-mno345
```

- [ ] **Step 2: Create fixture depco.config.ts**

Create `src/cli/commands/scan/__tests__/fixtures/depco.config.ts`:

```typescript
import type { IDepcoConfig } from "#shared/config/types.js";

const config: IDepcoConfig = {
  scan: {
    license: {
      allowedRiskTiers: ["permissive"],
      ignoredPackages: []
    },
    vulnerability: {
      maxSeverity: "high",
      ignoredPackages: []
    },
    ignoredPackages: [],
    registryUrl: "https://registry.npmjs.org"
  }
};

export default config;
```

- [ ] **Step 3: Write the integration test file scaffold and helpers**

Create `src/cli/commands/scan/__tests__/ScanPipeline.integration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { createContainer, registerFeatures } from "#shared/index.js";
import { ScanCommandFeature } from "../feature.js";
import { StepRunnerFeature } from "../../../runner/index.js";
import { ScanCommand } from "../abstractions/ScanCommand.js";
import { StepRunner } from "../../../runner/abstractions/StepRunner.js";
import { LockfileParserService } from "#api/services/DependencyGraph/abstractions/LockfileParserService.js";
import type { IDependencyEdge } from "#api/services/DependencyGraph/abstractions/LockfileParserService.js";
import type { IPackageEntry } from "#shared/types/IPackageEntry.js";
import type { Container } from "@webiny/di";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

const FIXTURE_PACKAGES: IPackageEntry[] = [
  { name: "express", version: "4.18.2" },
  { name: "lodash", version: "4.17.21" },
  { name: "left-pad", version: "1.3.0" },
  { name: "gpl-licensed", version: "1.0.0" },
  { name: "safe-pkg", version: "2.0.0" }
];

function createMockEdges(packages: IPackageEntry[]): IDependencyEdge[] {
  return packages.map(packageEntry => ({
    parentPackage: null,
    parentVersion: null,
    childPackage: packageEntry.name,
    childVersion: packageEntry.version,
    dependencyType: "dependencies",
    depth: 1
  }));
}

function createMockLockfileParser(): LockfileParserService.Interface {
  return {
    parse: vi.fn().mockResolvedValue(createMockEdges(FIXTURE_PACKAGES))
  };
}

function mockFetchLicenses(): void {
  const licenseMap: Record<string, string> = {
    express: "MIT",
    lodash: "MIT",
    "left-pad": "MIT",
    "gpl-licensed": "GPL-3.0",
    "safe-pkg": "MIT"
  };

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const packageName = Object.keys(licenseMap).find(name => url.includes(`/${name}/`));
    const license = packageName ? licenseMap[packageName] : "UNKNOWN";

    return new Response(JSON.stringify({ license }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
}

function mockExecSync(
  vulnerabilities: Array<{ name: string; severity: string; title: string; url: string }>
): void {
  const auditOutput = {
    advisories: Object.fromEntries(
      vulnerabilities.map((vulnerability, index) => [
        String(index),
        {
          module_name: vulnerability.name,
          severity: vulnerability.severity,
          title: vulnerability.title,
          url: vulnerability.url,
          cves: [],
          vulnerable_versions: "<999.0.0",
          patched_versions: ">=999.0.0"
        }
      ])
    )
  };

  vi.mocked(execSync).mockReturnValue(JSON.stringify(auditOutput));
}

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue("{}")
}));

function setupContainer(): Container {
  const container = createContainer();
  registerFeatures(container, [StepRunnerFeature, ScanCommandFeature]);
  container.registerInstance(LockfileParserService, createMockLockfileParser());
  return container;
}

function runPipeline(args: { container: Container; check?: string; format?: string }): {
  runner: StepRunner.Interface;
  command: ScanCommand.Interface;
} {
  const runner = args.container.resolve(StepRunner);
  const command = args.container.resolve(ScanCommand);
  return { runner, command };
}
```

- [ ] **Step 4: Write test — license check with table format**

Add to the test file:

```typescript
describe("ScanPipeline integration", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let originalExitCode: number | undefined;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        originalExitCode = process.exitCode;
        process.exitCode = undefined;
        mockFetchLicenses();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.exitCode = originalExitCode;
    });

    it("runs license check with table format", async () => {
        const container = setupContainer();
        const { runner, command } = runPipeline({ container });
        const context = command.context({ check: "license", format: "table" });
        context.dataDirectory = FIXTURES_DIR;

        await runner.run({ steps: command.steps(), context });

        const output = consoleSpy.mock.calls.map(call => String(call[0])).join("\n");
        expect(output).toContain("gpl-licensed");
        expect(output).toContain("GPL-3.0");
        expect(output).toContain("copyleft");
    });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn vitest run src/cli/commands/scan/__tests__/ScanPipeline.integration.test.ts`
Expected: PASS

- [ ] **Step 6: Write test — vulnerability check with JSON format**

```typescript
it("runs vulnerability check with json format", async () => {
  const container = setupContainer();
  mockExecSync([
    {
      name: "express",
      severity: "critical",
      title: "RCE in express",
      url: "https://ghsa.example/1"
    }
  ]);

  const { runner, command } = runPipeline({ container });
  const context = command.context({ check: "vulnerability", format: "json" });
  context.dataDirectory = FIXTURES_DIR;

  await runner.run({ steps: command.steps(), context });

  const output = consoleSpy.mock.calls.map(call => String(call[0])).join("\n");
  const parsed = JSON.parse(output.split("\n").filter(line => line.startsWith("{"))[0]!);
  expect(parsed.findings.vulnerability).toHaveLength(1);
  expect(parsed.findings.vulnerability[0].packageName).toBe("express");
  expect(parsed.findings.vulnerability[0].severity).toBe("critical");
});
```

- [ ] **Step 7: Write test — all checks with CSV format**

```typescript
it("runs all checks with csv format", async () => {
  const container = setupContainer();
  mockExecSync([
    {
      name: "lodash",
      severity: "high",
      title: "Prototype pollution",
      url: "https://ghsa.example/2"
    }
  ]);

  const { runner, command } = runPipeline({ container });
  const context = command.context({ check: "all", format: "csv" });
  context.dataDirectory = FIXTURES_DIR;

  await runner.run({ steps: command.steps(), context });

  const output = consoleSpy.mock.calls.map(call => String(call[0])).join("\n");
  const csvOutput = output
    .split("\n")
    .filter(
      line =>
        line.startsWith("type,") || line.startsWith("license,") || line.startsWith("vulnerability,")
    )
    .join("\n");

  expect(csvOutput).toContain("type,package,version,detail,severity,source,fixVersion");
  expect(csvOutput).toContain("license,gpl-licensed");
  expect(csvOutput).toContain("vulnerability,lodash");
});
```

- [ ] **Step 8: Write test — SARIF format**

```typescript
it("outputs valid sarif format", async () => {
  const container = setupContainer();
  mockExecSync([
    { name: "express", severity: "critical", title: "RCE", url: "https://ghsa.example/3" }
  ]);

  const { runner, command } = runPipeline({ container });
  const context = command.context({ check: "all", format: "sarif" });
  context.dataDirectory = FIXTURES_DIR;

  await runner.run({ steps: command.steps(), context });

  const output = consoleSpy.mock.calls.map(call => String(call[0])).join("\n");
  const sarifLine = output.split("\n").find(line => line.includes('"$schema"'));
  expect(sarifLine).toBeDefined();
  const sarif = JSON.parse(sarifLine!);
  expect(sarif.version).toBe("2.1.0");
  expect(sarif.runs).toHaveLength(1);
  expect(sarif.runs[0].results.length).toBeGreaterThan(0);
});
```

- [ ] **Step 9: Write test — exit code 1 on license violations**

```typescript
it("sets exit code 1 on license violations", async () => {
  const container = setupContainer();
  const { runner, command } = runPipeline({ container });
  const context = command.context({ check: "license", format: "table" });
  context.dataDirectory = FIXTURES_DIR;

  await runner.run({ steps: command.steps(), context });

  expect(process.exitCode).toBe(1);
});
```

- [ ] **Step 10: Write test — exit code 1 on vulnerability severity threshold**

```typescript
it("sets exit code 1 when vulnerability exceeds maxSeverity threshold", async () => {
  const container = setupContainer();
  mockExecSync([
    { name: "express", severity: "critical", title: "RCE", url: "https://ghsa.example/4" }
  ]);

  const { runner, command } = runPipeline({ container });
  const context = command.context({ check: "vulnerability", format: "table" });
  context.dataDirectory = FIXTURES_DIR;

  await runner.run({ steps: command.steps(), context });

  // maxSeverity is "high" in fixture config, critical exceeds it
  expect(process.exitCode).toBe(1);
});
```

- [ ] **Step 11: Write test — OSV graceful degradation**

```typescript
it("completes pipeline when OSV query fails", async () => {
  const container = setupContainer();
  mockExecSync([
    { name: "express", severity: "high", title: "Known issue", url: "https://ghsa.example/5" }
  ]);

  // OSV will fail because fetch is mocked for license responses only.
  // The CheckVulnerabilitiesStep catches OSV errors and continues with audit-only results.

  const { runner, command } = runPipeline({ container });
  const context = command.context({ check: "all", format: "json" });
  context.dataDirectory = FIXTURES_DIR;

  // Pipeline should not throw
  await expect(runner.run({ steps: command.steps(), context })).resolves.toBeUndefined();

  const output = consoleSpy.mock.calls.map(call => String(call[0])).join("\n");
  expect(output).toContain("express");
});
```

- [ ] **Step 12: Close the describe block**

```typescript
});
```

- [ ] **Step 13: Run all integration tests**

Run: `yarn vitest run src/cli/commands/scan/__tests__/ScanPipeline.integration.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 14: Run full suite**

Run: `yarn full`
Expected: All lint, format, build, and tests pass (existing + new).

- [ ] **Step 15: Commit**

```bash
git add src/cli/commands/scan/__tests__/fixtures/ src/cli/commands/scan/__tests__/ScanPipeline.integration.test.ts
git commit -m "test: add E2E integration tests for CLI scan pipeline"
```
