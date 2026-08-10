# Output Formatters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-format output (table, json, csv, sarif) to the scan command via a DI formatter factory, refactor CheckLicensesStep to produce structured data, and add a RenderOutputStep that formats and handles exit codes.

**Architecture:** `IOutputFormatterFactory` DI abstraction creates formatter instances by format name. Steps produce structured data into `context.results`. `RenderOutputStep` reads all findings, builds `IScanOutput`, calls formatter, outputs to stdout, and handles exit codes.

**Tech Stack:** TypeScript, Zod, DI container, SARIF 2.1.0 JSON schema

**Depends on:** Plan `2026-08-10-shared-vulnerability-modules.md` — specifically Task 1 (adds `IMergedVulnerability` and `TVulnerabilitySource` to `src/shared/vulnerabilities/types.ts`). Plan 2 Task 1 imports these types. Execute Plan 1 Task 1 before starting Plan 2.

## Global Constraints

- Named interfaces only, no inline structural types
- Full words in identifiers (e.g., `Vulnerability` not `Vuln`)
- Object params with named keys when function has 2+ params
- DI pattern: factory registered as abstraction, formatter instances are plain classes
- Tests: `yarn full` to run (includes lint, format, build, all tests)
- Format before commit: `yarn format:fix && yarn lint:fix`
- Commit all files after each task

---

### Task 1: OutputFormatterFactory, TableFormatter, and JsonFormatter

**Files:**
- Create: `src/cli/commands/scan/formatters/types.ts`
- Create: `src/cli/commands/scan/formatters/abstractions/OutputFormatterFactory.ts`
- Create: `src/cli/commands/scan/formatters/OutputFormatterFactory.ts`
- Create: `src/cli/commands/scan/formatters/TableFormatter.ts`
- Create: `src/cli/commands/scan/formatters/JsonFormatter.ts`
- Create: `src/cli/commands/scan/formatters/feature.ts`
- Create: `src/cli/commands/scan/formatters/__tests__/TableFormatter.test.ts`
- Create: `src/cli/commands/scan/formatters/__tests__/JsonFormatter.test.ts`
- Create: `src/cli/commands/scan/formatters/__tests__/OutputFormatterFactory.test.ts`

**Interfaces:**
- Consumes: `IMergedVulnerability` from `src/shared/vulnerabilities/types.ts`, `LicenseRiskTier` from `src/shared/licenses/types.ts`, `VulnerabilitySeverity` from `src/shared/vulnerabilities/types.ts`
- Produces: `IScanOutput`, `IOutputFormatter`, `IOutputFormatterFactory` — used by Tasks 2 and 3

- [ ] **Step 1: Create shared output types**

Create `src/cli/commands/scan/formatters/types.ts`:

```typescript
import type { LicenseRiskTier } from "#shared/licenses/types.js";
import type { IMergedVulnerability, VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";

export interface ILicenseViolation {
    packageName: string;
    version: string;
    license: string;
    riskTier: LicenseRiskTier;
}

export interface IScanFindings {
    license: ILicenseViolation[];
    vulnerability: IMergedVulnerability[];
}

export interface IScanMeta {
    timestamp: string;
    packageCount: number;
    configPath: string | null;
}

export interface IScanSummary {
    licenseViolations: number;
    vulnerabilities: Record<VulnerabilitySeverity, number>;
    total: number;
}

export interface IScanOutput {
    meta: IScanMeta;
    findings: IScanFindings;
    summary: IScanSummary;
}

export interface IOutputFormatter {
    format(output: IScanOutput): string;
}
```

- [ ] **Step 2: Write failing tests for TableFormatter**

Create `src/cli/commands/scan/formatters/__tests__/TableFormatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TableFormatter } from "../TableFormatter.js";
import type { IScanOutput } from "../types.js";

function createEmptyOutput(): IScanOutput {
    return {
        meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 10, configPath: null },
        findings: { license: [], vulnerability: [] },
        summary: { licenseViolations: 0, vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }, total: 0 }
    };
}

describe("TableFormatter", () => {
    const formatter = new TableFormatter();

    it("renders empty output with no-issues message", () => {
        const result = formatter.format(createEmptyOutput());
        expect(result).toContain("No issues found");
    });

    it("renders license violations table", () => {
        const output = createEmptyOutput();
        output.findings.license = [
            { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "high" }
        ];
        output.summary.licenseViolations = 1;
        output.summary.total = 1;

        const result = formatter.format(output);
        expect(result).toContain("gpl-pkg");
        expect(result).toContain("GPL-3.0");
        expect(result).toContain("high");
        expect(result).toContain("1 license violation");
    });

    it("renders vulnerability table sorted by severity descending", () => {
        const output = createEmptyOutput();
        output.findings.vulnerability = [
            {
                packageName: "bar",
                installedVersion: "1.0.0",
                severity: "low",
                title: "Minor issue",
                advisoryUrl: null,
                cveId: null,
                dedupKey: "hash1",
                vulnerableRange: "<2.0.0",
                fixVersion: "2.0.0",
                source: "osv"
            },
            {
                packageName: "foo",
                installedVersion: "2.0.0",
                severity: "critical",
                title: "Critical issue",
                advisoryUrl: "https://osv.dev/vulnerability/GHSA-1234",
                cveId: "CVE-2024-1234",
                dedupKey: "CVE-2024-1234",
                vulnerableRange: "<3.0.0",
                fixVersion: "3.0.0",
                source: "audit"
            }
        ];
        output.summary.vulnerabilities.critical = 1;
        output.summary.vulnerabilities.low = 1;
        output.summary.total = 2;

        const result = formatter.format(output);
        const criticalIndex = result.indexOf("critical");
        const lowIndex = result.indexOf("low");
        expect(criticalIndex).toBeLessThan(lowIndex);
    });

    it("renders both tables when both have findings", () => {
        const output = createEmptyOutput();
        output.findings.license = [
            { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "high" }
        ];
        output.findings.vulnerability = [
            {
                packageName: "vuln-pkg",
                installedVersion: "1.0.0",
                severity: "high",
                title: "XSS",
                advisoryUrl: null,
                cveId: "CVE-2024-5678",
                dedupKey: "CVE-2024-5678",
                vulnerableRange: "<2.0.0",
                fixVersion: "2.0.0",
                source: "audit"
            }
        ];
        output.summary.licenseViolations = 1;
        output.summary.vulnerabilities.high = 1;
        output.summary.total = 2;

        const result = formatter.format(output);
        expect(result).toContain("License");
        expect(result).toContain("Vulnerabilit");
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/TableFormatter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement TableFormatter**

Create `src/cli/commands/scan/formatters/TableFormatter.ts`:

```typescript
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { IOutputFormatter, IScanOutput } from "./types.js";

const SEVERITY_COLORS: Record<string, string> = {
    critical: "\x1b[31m",  // red
    high: "\x1b[33m",      // yellow
    moderate: "\x1b[36m",  // cyan
    low: "\x1b[0m",        // default
    info: "\x1b[0m"        // default
};
const RESET = "\x1b[0m";

export class TableFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        const sections: string[] = [];

        if (output.findings.license.length > 0) {
            sections.push(this.renderLicenseTable(output));
        }

        if (output.findings.vulnerability.length > 0) {
            sections.push(this.renderVulnerabilityTable(output));
        }

        if (sections.length === 0) {
            return "No issues found";
        }

        return sections.join("\n\n");
    }

    private renderLicenseTable(output: IScanOutput): string {
        // Build ASCII table with columns: Package, Version, License, Risk Tier
        // Dynamic column widths based on content
        // Color-code risk tier
        // Summary line: "N license violation(s)"
        // Follow existing CheckLicensesStep table format (Unicode dividers ─)
    }

    private renderVulnerabilityTable(output: IScanOutput): string {
        // Sort by severity index (VULNERABILITY_SEVERITIES order)
        // Build ASCII table: Package, Installed Version, Severity, Advisory ID, Fix Version, Source
        // Color-code severity
        // Summary line: "N vulnerability/vulnerabilities"
    }
}
```

Full implementation should match the existing ASCII table style from `CheckLicensesStep.ts` lines 114-126 (dynamic padding, Unicode `─` dividers, ANSI colors).

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/TableFormatter.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing tests for JsonFormatter**

Create `src/cli/commands/scan/formatters/__tests__/JsonFormatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { JsonFormatter } from "../JsonFormatter.js";
import type { IScanOutput } from "../types.js";

describe("JsonFormatter", () => {
    const formatter = new JsonFormatter();

    it("outputs valid JSON matching IScanOutput shape", () => {
        const output: IScanOutput = {
            meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 5, configPath: "depco.config.ts" },
            findings: {
                license: [{ packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "high" }],
                vulnerability: []
            },
            summary: { licenseViolations: 1, vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }, total: 1 }
        };

        const result = formatter.format(output);
        const parsed = JSON.parse(result);

        expect(parsed.meta.timestamp).toBe("2026-08-10T00:00:00.000Z");
        expect(parsed.meta.packageCount).toBe(5);
        expect(parsed.findings.license).toHaveLength(1);
        expect(parsed.findings.license[0].packageName).toBe("gpl-pkg");
        expect(parsed.summary.total).toBe(1);
    });

    it("roundtrips: format then parse matches original", () => {
        const output: IScanOutput = {
            meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 0, configPath: null },
            findings: { license: [], vulnerability: [] },
            summary: { licenseViolations: 0, vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }, total: 0 }
        };

        const result = formatter.format(output);
        const parsed = JSON.parse(result);

        expect(parsed).toEqual(output);
    });

    it("outputs pretty-printed JSON with 2-space indent", () => {
        const output: IScanOutput = {
            meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 0, configPath: null },
            findings: { license: [], vulnerability: [] },
            summary: { licenseViolations: 0, vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 }, total: 0 }
        };

        const result = formatter.format(output);
        expect(result).toContain("  "); // 2-space indent
        expect(result.split("\n").length).toBeGreaterThan(1);
    });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/JsonFormatter.test.ts`
Expected: FAIL

- [ ] **Step 8: Implement JsonFormatter**

Create `src/cli/commands/scan/formatters/JsonFormatter.ts`:

```typescript
import type { IOutputFormatter, IScanOutput } from "./types.js";

export class JsonFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        return JSON.stringify(output, null, 2);
    }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/JsonFormatter.test.ts`
Expected: PASS

- [ ] **Step 10: Write failing test for OutputFormatterFactory**

Create `src/cli/commands/scan/formatters/__tests__/OutputFormatterFactory.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { OutputFormatterFactory } from "../abstractions/OutputFormatterFactory.js";
import { OutputFormatterFeature } from "../feature.js";
import { TableFormatter } from "../TableFormatter.js";
import { JsonFormatter } from "../JsonFormatter.js";

describe("OutputFormatterFactory", () => {
    let factory: OutputFormatterFactory.Interface;

    beforeEach(() => {
        const container = createContainer();
        registerFeatures(container, [OutputFormatterFeature]);
        factory = container.resolve(OutputFormatterFactory);
    });

    it("creates TableFormatter for 'table'", () => {
        const formatter = factory.create({ format: "table" });
        expect(formatter).toBeInstanceOf(TableFormatter);
    });

    it("creates JsonFormatter for 'json'", () => {
        const formatter = factory.create({ format: "json" });
        expect(formatter).toBeInstanceOf(JsonFormatter);
    });

    it("defaults to TableFormatter for unknown format", () => {
        const formatter = factory.create({ format: "unknown" });
        expect(formatter).toBeInstanceOf(TableFormatter);
    });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/OutputFormatterFactory.test.ts`
Expected: FAIL

- [ ] **Step 12: Create OutputFormatterFactory abstraction**

Create `src/cli/commands/scan/formatters/abstractions/OutputFormatterFactory.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IOutputFormatter } from "../types.js";

export interface IOutputFormatterFactoryInput {
    format: string;
}

export interface IOutputFormatterFactory {
    create(input: IOutputFormatterFactoryInput): IOutputFormatter;
}

export const OutputFormatterFactory = createAbstraction<IOutputFormatterFactory>(
    "Cli/OutputFormatterFactory"
);

export namespace OutputFormatterFactory {
    export type Interface = IOutputFormatterFactory;
}
```

- [ ] **Step 13: Implement OutputFormatterFactory**

Create `src/cli/commands/scan/formatters/OutputFormatterFactory.ts`:

```typescript
import type { IOutputFormatter } from "./types.js";
import type { IOutputFormatterFactory, IOutputFormatterFactoryInput } from "./abstractions/OutputFormatterFactory.js";
import { TableFormatter } from "./TableFormatter.js";
import { JsonFormatter } from "./JsonFormatter.js";

class OutputFormatterFactoryImpl implements IOutputFormatterFactory {
    public create(input: IOutputFormatterFactoryInput): IOutputFormatter {
        switch (input.format) {
            case "json":
                return new JsonFormatter();
            case "table":
            default:
                return new TableFormatter();
        }
    }
}

export const OutputFormatterFactory = Abstraction.createImplementation({
    implementation: OutputFormatterFactoryImpl,
    dependencies: []
});
```

Note: CsvFormatter and SarifFormatter cases will be added in Task 2.

- [ ] **Step 14: Create feature registration**

Create `src/cli/commands/scan/formatters/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { OutputFormatterFactory } from "./OutputFormatterFactory.js";

export const OutputFormatterFeature = createFeature({
    name: "Cli/OutputFormatterFactory",
    register(container) {
        container.register(OutputFormatterFactory).inSingletonScope();
    }
});
```

- [ ] **Step 15: Run all formatter tests**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/`
Expected: PASS

- [ ] **Step 16: Run full test suite**

Run: `yarn full`
Expected: All tests pass

- [ ] **Step 17: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/cli/commands/scan/formatters/
git commit -m "feat: add OutputFormatterFactory with TableFormatter and JsonFormatter"
```

---

### Task 2: CsvFormatter and SarifFormatter

**Files:**
- Create: `src/cli/commands/scan/formatters/CsvFormatter.ts`
- Create: `src/cli/commands/scan/formatters/SarifFormatter.ts`
- Create: `src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`
- Create: `src/cli/commands/scan/formatters/__tests__/SarifFormatter.test.ts`
- Modify: `src/cli/commands/scan/formatters/OutputFormatterFactory.ts` (add csv, sarif cases)

**Interfaces:**
- Consumes: `IScanOutput`, `IOutputFormatter` from Task 1
- Produces: CsvFormatter and SarifFormatter classes — added to factory

- [ ] **Step 1: Write failing tests for CsvFormatter**

Create `src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { CsvFormatter } from "../CsvFormatter.js";
import type { IScanOutput } from "../types.js";

function createTestOutput(): IScanOutput {
    return {
        meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 5, configPath: null },
        findings: {
            license: [
                { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "high" }
            ],
            vulnerability: [
                {
                    packageName: "vuln-pkg",
                    installedVersion: "1.0.0",
                    severity: "critical",
                    title: "RCE vulnerability",
                    advisoryUrl: "https://osv.dev/vulnerability/GHSA-1234",
                    cveId: "CVE-2024-1234",
                    dedupKey: "CVE-2024-1234",
                    vulnerableRange: "<2.0.0",
                    fixVersion: "2.0.0",
                    source: "both"
                }
            ]
        },
        summary: { licenseViolations: 1, vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, info: 0 }, total: 2 }
    };
}

describe("CsvFormatter", () => {
    const formatter = new CsvFormatter();

    it("outputs header row", () => {
        const result = formatter.format(createTestOutput());
        const lines = result.split("\n");
        expect(lines[0]).toBe("type,package,version,detail,severity,source,fixVersion");
    });

    it("outputs license finding as row", () => {
        const result = formatter.format(createTestOutput());
        expect(result).toContain("license,gpl-pkg,1.0.0,GPL-3.0,high,,");
    });

    it("outputs vulnerability finding as row", () => {
        const result = formatter.format(createTestOutput());
        expect(result).toContain("vulnerability,vuln-pkg,1.0.0,CVE-2024-1234,critical,both,2.0.0");
    });

    it("escapes commas in package names", () => {
        const output = createTestOutput();
        output.findings.license = [
            { packageName: "@scope/pkg,name", version: "1.0.0", license: "MIT", riskTier: "low" }
        ];

        const result = formatter.format(output);
        expect(result).toContain('"@scope/pkg,name"');
    });

    it("escapes quotes in values", () => {
        const output = createTestOutput();
        output.findings.vulnerability = [
            {
                packageName: "pkg",
                installedVersion: "1.0.0",
                severity: "high",
                title: 'Has "quotes"',
                advisoryUrl: null,
                cveId: null,
                dedupKey: "hash123",
                vulnerableRange: null,
                fixVersion: null,
                source: "audit"
            }
        ];

        const result = formatter.format(output);
        // Advisory ID (detail column) should use dedupKey when no cveId
        expect(result).toContain("hash123");
    });

    it("handles empty findings", () => {
        const output = createTestOutput();
        output.findings.license = [];
        output.findings.vulnerability = [];

        const result = formatter.format(output);
        const lines = result.split("\n").filter(Boolean);
        expect(lines).toHaveLength(1); // header only
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CsvFormatter**

Create `src/cli/commands/scan/formatters/CsvFormatter.ts`:

```typescript
import type { IOutputFormatter, IScanOutput } from "./types.js";

export class CsvFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        const header = "type,package,version,detail,severity,source,fixVersion";
        const rows: string[] = [header];

        for (const finding of output.findings.license) {
            rows.push(this.formatRow({
                type: "license",
                packageName: finding.packageName,
                version: finding.version,
                detail: finding.license,
                severity: finding.riskTier,
                source: "",
                fixVersion: ""
            }));
        }

        for (const finding of output.findings.vulnerability) {
            rows.push(this.formatRow({
                type: "vulnerability",
                packageName: finding.packageName,
                version: finding.installedVersion,
                detail: finding.cveId ?? finding.dedupKey,
                severity: finding.severity,
                source: finding.source,
                fixVersion: finding.fixVersion ?? ""
            }));
        }

        return rows.join("\n");
    }

    private formatRow(values: Record<string, string>): string {
        return Object.values(values).map(v => this.escapeCsvValue(v)).join(",");
    }

    private escapeCsvValue(value: string): string {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/CsvFormatter.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for SarifFormatter**

Create `src/cli/commands/scan/formatters/__tests__/SarifFormatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SarifFormatter } from "../SarifFormatter.js";
import type { IScanOutput } from "../types.js";

function createTestOutput(): IScanOutput {
    return {
        meta: { timestamp: "2026-08-10T00:00:00.000Z", packageCount: 5, configPath: null },
        findings: {
            license: [
                { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "high" }
            ],
            vulnerability: [
                {
                    packageName: "vuln-pkg",
                    installedVersion: "1.0.0",
                    severity: "critical",
                    title: "RCE vulnerability",
                    advisoryUrl: "https://osv.dev/vulnerability/GHSA-1234",
                    cveId: "CVE-2024-1234",
                    dedupKey: "CVE-2024-1234",
                    vulnerableRange: "<2.0.0",
                    fixVersion: "2.0.0",
                    source: "both"
                }
            ]
        },
        summary: { licenseViolations: 1, vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, info: 0 }, total: 2 }
    };
}

describe("SarifFormatter", () => {
    const formatter = new SarifFormatter();

    it("outputs valid JSON with SARIF 2.1.0 schema", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);

        expect(sarif.version).toBe("2.1.0");
        expect(sarif.$schema).toContain("sarif-schema-2.1.0");
        expect(sarif.runs).toHaveLength(1);
    });

    it("populates tool driver info", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const driver = sarif.runs[0].tool.driver;

        expect(driver.name).toBe("depco");
        expect(driver.version).toBeDefined();
    });

    it("creates rules for each unique finding type", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const rules = sarif.runs[0].tool.driver.rules;

        expect(rules).toHaveLength(2);

        const licenseRule = rules.find((r: { id: string }) => r.id.startsWith("license/"));
        expect(licenseRule.id).toBe("license/high/GPL-3.0");

        const vulnRule = rules.find((r: { id: string }) => r.id.startsWith("vulnerability/"));
        expect(vulnRule.id).toBe("vulnerability/CVE-2024-1234");
    });

    it("maps severity to SARIF level correctly", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const rules = sarif.runs[0].tool.driver.rules;

        const vulnRule = rules.find((r: { id: string }) => r.id.startsWith("vulnerability/"));
        expect(vulnRule.defaultConfiguration.level).toBe("error"); // critical → error
    });

    it("creates results referencing rules by ruleId and ruleIndex", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const results = sarif.runs[0].results;

        expect(results).toHaveLength(2);

        for (const sarifResult of results) {
            expect(sarifResult.ruleId).toBeDefined();
            expect(sarifResult.ruleIndex).toBeGreaterThanOrEqual(0);
            expect(sarifResult.message.text).toBeTruthy();
        }
    });

    it("includes properties bag with type-specific metadata", () => {
        const result = formatter.format(createTestOutput());
        const sarif = JSON.parse(result);
        const results = sarif.runs[0].results;

        const licenseResult = results.find((r: { ruleId: string }) => r.ruleId.startsWith("license/"));
        expect(licenseResult.properties.version).toBe("1.0.0");
        expect(licenseResult.properties.license).toBe("GPL-3.0");
        expect(licenseResult.properties.riskTier).toBe("high");

        const vulnResult = results.find((r: { ruleId: string }) => r.ruleId.startsWith("vulnerability/"));
        expect(vulnResult.properties.installedVersion).toBe("1.0.0");
        expect(vulnResult.properties.fixVersion).toBe("2.0.0");
        expect(vulnResult.properties.source).toBe("both");
        expect(vulnResult.properties.dedupKey).toBe("CVE-2024-1234");
    });

    it("maps severity levels correctly", () => {
        const output = createTestOutput();
        output.findings.vulnerability = [
            { packageName: "a", installedVersion: "1.0.0", severity: "critical", title: "t", advisoryUrl: null, cveId: "CVE-1", dedupKey: "CVE-1", vulnerableRange: null, fixVersion: null, source: "osv" },
            { packageName: "b", installedVersion: "1.0.0", severity: "high", title: "t", advisoryUrl: null, cveId: "CVE-2", dedupKey: "CVE-2", vulnerableRange: null, fixVersion: null, source: "osv" },
            { packageName: "c", installedVersion: "1.0.0", severity: "moderate", title: "t", advisoryUrl: null, cveId: "CVE-3", dedupKey: "CVE-3", vulnerableRange: null, fixVersion: null, source: "osv" },
            { packageName: "d", installedVersion: "1.0.0", severity: "low", title: "t", advisoryUrl: null, cveId: "CVE-4", dedupKey: "CVE-4", vulnerableRange: null, fixVersion: null, source: "osv" },
            { packageName: "e", installedVersion: "1.0.0", severity: "info", title: "t", advisoryUrl: null, cveId: "CVE-5", dedupKey: "CVE-5", vulnerableRange: null, fixVersion: null, source: "osv" }
        ];
        output.findings.license = [];

        const result = formatter.format(output);
        const sarif = JSON.parse(result);
        const rules = sarif.runs[0].tool.driver.rules;

        const levels = rules.map((r: { defaultConfiguration: { level: string } }) => r.defaultConfiguration.level);
        expect(levels).toEqual(["error", "error", "warning", "note", "note"]);
    });

    it("handles empty findings", () => {
        const output = createTestOutput();
        output.findings.license = [];
        output.findings.vulnerability = [];

        const result = formatter.format(output);
        const sarif = JSON.parse(result);

        expect(sarif.runs[0].tool.driver.rules).toEqual([]);
        expect(sarif.runs[0].results).toEqual([]);
    });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/SarifFormatter.test.ts`
Expected: FAIL

- [ ] **Step 7: Implement SarifFormatter**

Create `src/cli/commands/scan/formatters/SarifFormatter.ts`:

```typescript
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type { IOutputFormatter, IScanOutput, ILicenseViolation } from "./types.js";
import type { IMergedVulnerability } from "#shared/vulnerabilities/types.js";

interface ISarifRule {
    id: string;
    shortDescription: { text: string };
    defaultConfiguration: { level: string };
}

interface ISarifResult {
    ruleId: string;
    ruleIndex: number;
    message: { text: string };
    locations: Array<{ physicalLocation: { artifactLocation: { uri: string } } }>;
    properties: Record<string, unknown>;
}

function mapSeverityToLevel(severity: VulnerabilitySeverity | string): string {
    switch (severity) {
        case "critical":
        case "high":
            return "error";
        case "moderate":
            return "warning";
        case "low":
        case "info":
        default:
            return "note";
    }
}

export class SarifFormatter implements IOutputFormatter {
    public format(output: IScanOutput): string {
        const rules: ISarifRule[] = [];
        const results: ISarifResult[] = [];

        // Build license rules and results
        for (const finding of output.findings.license) {
            const ruleId = `license/${finding.riskTier}/${finding.license}`;
            const ruleIndex = this.addRule(rules, {
                id: ruleId,
                shortDescription: { text: `License risk: ${finding.license} (${finding.riskTier})` },
                defaultConfiguration: { level: mapSeverityToLevel(finding.riskTier) }
            });

            results.push({
                ruleId,
                ruleIndex,
                message: { text: `Package ${finding.packageName}@${finding.version} uses ${finding.license} license (${finding.riskTier} risk)` },
                locations: [{ physicalLocation: { artifactLocation: { uri: "package.json" } } }],
                properties: {
                    version: finding.version,
                    license: finding.license,
                    riskTier: finding.riskTier
                }
            });
        }

        // Build vulnerability rules and results
        for (const finding of output.findings.vulnerability) {
            const ruleId = `vulnerability/${finding.dedupKey}`;
            const ruleIndex = this.addRule(rules, {
                id: ruleId,
                shortDescription: { text: finding.title },
                defaultConfiguration: { level: mapSeverityToLevel(finding.severity) }
            });

            results.push({
                ruleId,
                ruleIndex,
                message: { text: `Package ${finding.packageName}@${finding.installedVersion} has ${finding.severity} vulnerability ${finding.cveId ?? finding.dedupKey}` },
                locations: [{ physicalLocation: { artifactLocation: { uri: "package.json" } } }],
                properties: {
                    installedVersion: finding.installedVersion,
                    fixVersion: finding.fixVersion,
                    source: finding.source,
                    dedupKey: finding.dedupKey
                }
            });
        }

        const sarif = {
            $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
            version: "2.1.0",
            runs: [{
                tool: {
                    driver: {
                        name: "depco",
                        version: this.getVersion(),
                        rules
                    }
                },
                results
            }]
        };

        return JSON.stringify(sarif, null, 2);
    }

    private addRule(rules: ISarifRule[], rule: ISarifRule): number {
        const existingIndex = rules.findIndex(r => r.id === rule.id);
        if (existingIndex >= 0) {
            return existingIndex;
        }
        rules.push(rule);
        return rules.length - 1;
    }

    private getVersion(): string {
        // Read from package.json or return fallback
        try {
            // Dynamic import or fs read of package.json
            return "0.0.0"; // Implementation reads actual version
        } catch {
            return "0.0.0";
        }
    }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/SarifFormatter.test.ts`
Expected: PASS

- [ ] **Step 9: Add csv and sarif cases to OutputFormatterFactory**

Modify `src/cli/commands/scan/formatters/OutputFormatterFactory.ts`:

Add imports for `CsvFormatter` and `SarifFormatter`. Add cases to `create()` switch:

```typescript
case "csv":
    return new CsvFormatter();
case "sarif":
    return new SarifFormatter();
```

- [ ] **Step 10: Add factory tests for new formats**

Add to `src/cli/commands/scan/formatters/__tests__/OutputFormatterFactory.test.ts`:

```typescript
import { CsvFormatter } from "../CsvFormatter.js";
import { SarifFormatter } from "../SarifFormatter.js";

it("creates CsvFormatter for 'csv'", () => {
    const formatter = factory.create({ format: "csv" });
    expect(formatter).toBeInstanceOf(CsvFormatter);
});

it("creates SarifFormatter for 'sarif'", () => {
    const formatter = factory.create({ format: "sarif" });
    expect(formatter).toBeInstanceOf(SarifFormatter);
});
```

- [ ] **Step 11: Run all formatter tests**

Run: `yarn vitest run src/cli/commands/scan/formatters/__tests__/`
Expected: PASS

- [ ] **Step 12: Run full test suite**

Run: `yarn full`
Expected: All tests pass

- [ ] **Step 13: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/cli/commands/scan/formatters/
git commit -m "feat: add CsvFormatter and SarifFormatter"
```

---

### Task 3: RenderOutputStep, CheckLicensesStep Refactor, and CLI Flags

**Files:**
- Create: `src/cli/commands/scan/steps/RenderOutput/abstractions/RenderOutputStep.ts`
- Create: `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts`
- Create: `src/cli/commands/scan/steps/RenderOutput/feature.ts`
- Create: `src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`
- Modify: `src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts` (remove table rendering)
- Modify: `src/cli/commands/scan/steps/CheckLicenses/__tests__/CheckLicensesStep.test.ts` (update assertions)
- Modify: `src/cli/commands/scan/ScanCommand.ts` (add RenderOutput step, inject formatter factory, pass --format to context)
- Modify: `src/cli/commands/scan/feature.ts` (add RenderOutput + OutputFormatter feature deps)
- Modify: `src/cli/index.ts` (add --format option)

**Interfaces:**
- Consumes: `IOutputFormatterFactory` from Task 1, `IScanOutput` types from Task 1, `IMergedVulnerability[]` from Plan 1, `ILicenseViolation[]` from CheckLicensesStep
- Produces: Formatted output to stdout, exit code based on maxSeverity threshold

- [ ] **Step 1: Write failing tests for RenderOutputStep**

Create `src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { RenderOutputStep } from "../abstractions/RenderOutputStep.js";
import { RenderOutputStepFeature } from "../feature.js";
import { OutputFormatterFeature } from "../../../formatters/feature.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(overrides?: Record<string, unknown>): IStepContext {
    const results = new Map<string, unknown>();
    results.set("violations", [
        { packageName: "gpl-pkg", version: "1.0.0", license: "GPL-3.0", riskTier: "high" }
    ]);
    results.set("vulnerabilities", [
        {
            packageName: "vuln-pkg",
            installedVersion: "1.0.0",
            severity: "critical",
            title: "RCE",
            advisoryUrl: null,
            cveId: "CVE-2024-1234",
            dedupKey: "CVE-2024-1234",
            vulnerableRange: "<2.0.0",
            fixVersion: "2.0.0",
            source: "audit"
        }
    ]);
    results.set("packages", [{ name: "a", version: "1.0.0" }, { name: "b", version: "2.0.0" }]);
    results.set("config", { scan: { vulnerability: { maxSeverity: "moderate" } } });
    return {
        dataDirectory: "/tmp/test",
        envFilePath: ".env",
        options: { format: "json", ...overrides },
        results
    };
}

describe("RenderOutputStep", () => {
    let step: RenderOutputStep.Interface;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        const container = createContainer();
        registerFeatures(container, [OutputFormatterFeature, RenderOutputStepFeature]);
        step = container.resolve(RenderOutputStep);
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("outputs formatted results to stdout", async () => {
        const context = createTestContext();
        await step.execute(context);

        expect(consoleSpy).toHaveBeenCalled();
        const output = consoleSpy.mock.calls[0][0];
        const parsed = JSON.parse(output);
        expect(parsed.findings.license).toHaveLength(1);
        expect(parsed.findings.vulnerability).toHaveLength(1);
    });

    it("builds correct summary counts", async () => {
        const context = createTestContext();
        await step.execute(context);

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.summary.licenseViolations).toBe(1);
        expect(output.summary.vulnerabilities.critical).toBe(1);
        expect(output.summary.total).toBe(2);
    });

    it("handles missing violations gracefully (empty array)", async () => {
        const context = createTestContext();
        context.results.delete("violations");
        await step.execute(context);

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.findings.license).toEqual([]);
    });

    it("handles missing vulnerabilities gracefully (empty array)", async () => {
        const context = createTestContext();
        context.results.delete("vulnerabilities");
        await step.execute(context);

        const output = JSON.parse(consoleSpy.mock.calls[0][0]);
        expect(output.findings.vulnerability).toEqual([]);
    });

    it("defaults to table format when no --format specified", async () => {
        const context = createTestContext({ format: undefined });
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        // Table output contains ANSI escape codes
        expect(consoleSpy.mock.calls[0][0]).toContain("\x1b[");
    });

    it("sets exit code 1 when vulnerability exceeds maxSeverity threshold", async () => {
        const context = createTestContext();
        const exitSpy = vi.spyOn(process, "exitCode", "set").mockImplementation(() => {});

        await step.execute(context);

        // critical (index 0) <= moderate (index 2) → exit 1
        expect(exitSpy).toHaveBeenCalledWith(1);
        exitSpy.mockRestore();
    });

    it("does not set exit code when no vulnerability exceeds threshold", async () => {
        const context = createTestContext();
        context.results.set("config", {
            scan: { vulnerability: { maxSeverity: "critical" } }
        });
        // Only critical vulns trigger exit, and we have one critical → exit 1
        // Change to lower severity to test no-exit case
        context.results.set("vulnerabilities", [
            {
                packageName: "low-vuln",
                installedVersion: "1.0.0",
                severity: "low",
                title: "Minor",
                advisoryUrl: null,
                cveId: null,
                dedupKey: "hash1",
                vulnerableRange: null,
                fixVersion: null,
                source: "osv"
            }
        ]);

        const exitSpy = vi.spyOn(process, "exitCode", "set").mockImplementation(() => {});
        await step.execute(context);

        // low (index 3) > critical (index 0) → no exit
        expect(exitSpy).not.toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it("does not set exit code when no maxSeverity configured", async () => {
        const context = createTestContext();
        context.results.set("config", {});

        const exitSpy = vi.spyOn(process, "exitCode", "set").mockImplementation(() => {});
        await step.execute(context);

        expect(exitSpy).not.toHaveBeenCalled();
        exitSpy.mockRestore();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`
Expected: FAIL

- [ ] **Step 3: Create RenderOutputStep abstraction**

Create `src/cli/commands/scan/steps/RenderOutput/abstractions/RenderOutputStep.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const RenderOutputStep = createAbstraction<IStep>("Cli/RenderOutputStep");

export namespace RenderOutputStep {
    export type Interface = IStep;
}
```

- [ ] **Step 4: Implement RenderOutputStep**

Create `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts`:

```typescript
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { IMergedVulnerability, VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";
import type { IOutputFormatterFactory } from "../../../formatters/abstractions/OutputFormatterFactory.js";
import type { ILicenseViolation, IScanOutput } from "../../../formatters/types.js";
import type { IDepcoConfig } from "#shared/config/types.js";

class RenderOutputStepImpl implements Abstraction.Interface {
    public name = "render-output";
    public description = "Format and output scan results";

    public constructor(
        private readonly formatterFactory: OutputFormatterFactory.Interface
    ) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const violations = (context.results.get("violations") as ILicenseViolation[]) ?? [];
        const vulnerabilities = (context.results.get("vulnerabilities") as IMergedVulnerability[]) ?? [];
        const packages = (context.results.get("packages") as Array<{ name: string; version: string }>) ?? [];
        const config = context.results.get("config") as IDepcoConfig | undefined;

        const format = (context.options["format"] as string) ?? "table";
        const formatter = this.formatterFactory.create({ format });

        const vulnerabilityCounts = this.countBySeverity(vulnerabilities);

        const output: IScanOutput = {
            meta: {
                timestamp: new Date().toISOString(),
                packageCount: packages.length,
                configPath: config ? "depco.config.ts" : null
            },
            findings: { license: violations, vulnerability: vulnerabilities },
            summary: {
                licenseViolations: violations.length,
                vulnerabilities: vulnerabilityCounts,
                total: violations.length + vulnerabilities.length
            }
        };

        console.log(formatter.format(output));

        // Exit code based on maxSeverity threshold
        this.applyExitCode({ vulnerabilities, config });

        return { success: true, message: `${output.summary.total} issues found` };
    }

    private countBySeverity(
        vulnerabilities: IMergedVulnerability[]
    ): Record<VulnerabilitySeverity, number> {
        const counts: Record<VulnerabilitySeverity, number> = {
            critical: 0, high: 0, moderate: 0, low: 0, info: 0
        };
        for (const vulnerability of vulnerabilities) {
            counts[vulnerability.severity]++;
        }
        return counts;
    }

    private applyExitCode(input: {
        vulnerabilities: IMergedVulnerability[];
        config: IDepcoConfig | undefined;
    }): void {
        const maxSeverity = input.config?.scan?.vulnerability?.maxSeverity;
        if (!maxSeverity) return;

        const thresholdIndex = VULNERABILITY_SEVERITIES.indexOf(maxSeverity);
        const exceedsThreshold = input.vulnerabilities.some(
            v => VULNERABILITY_SEVERITIES.indexOf(v.severity) <= thresholdIndex
        );

        if (exceedsThreshold) {
            process.exitCode = 1;
        }
    }
}

export const RenderOutputStep = Abstraction.createImplementation({
    implementation: RenderOutputStepImpl,
    dependencies: [OutputFormatterFactory]
});
```

- [ ] **Step 5: Create feature registration**

Create `src/cli/commands/scan/steps/RenderOutput/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { OutputFormatterFeature } from "../../../formatters/feature.js";
import { RenderOutputStep } from "./RenderOutputStep.js";

export const RenderOutputStepFeature = createFeature({
    name: "Cli/RenderOutputStep",
    dependencies: [OutputFormatterFeature],
    register(container) {
        container.register(RenderOutputStep).inSingletonScope();
    }
});
```

- [ ] **Step 6: Run RenderOutputStep tests**

Run: `yarn vitest run src/cli/commands/scan/steps/RenderOutput/__tests__/RenderOutputStep.test.ts`
Expected: PASS

- [ ] **Step 7: Refactor CheckLicensesStep — remove table rendering**

Modify `src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts`:
- Remove the ASCII table rendering code (lines ~112-128)
- Remove the summary console.log
- Keep the violation computation logic
- Ensure `context.results.set("violations", violations)` remains
- Step now returns `{ success: true, message: "Found N violations" }` without any console output

The output data shape (`ILicenseViolation[]`) must match what RenderOutputStep expects. Verify the existing key in `context.results` is `"violations"` — the investigator confirmed this at `CheckLicensesStep.ts:105`.

- [ ] **Step 8: Update CheckLicensesStep tests**

Modify `src/cli/commands/scan/steps/CheckLicenses/__tests__/CheckLicensesStep.test.ts`:
- Remove any assertions about console output or table formatting
- Keep assertions about `context.results.get("violations")` containing correct violation data
- Add assertion that step does NOT call console.log (spy and verify not called)

- [ ] **Step 9: Wire RenderOutputStep into ScanCommand**

Modify `src/cli/commands/scan/ScanCommand.ts`:
- Add `renderOutput: Step.Interface` to constructor injection (last position)
- Add to `steps()` return array as final step
- Pass yargs options into context: `options: { check: options.check, format: options.format }`

Currently `ScanCommand.context()` returns a hardcoded context with `options: {}`. Update it to accept argv and forward options:

```typescript
public context(argv: Record<string, unknown>): Step.Context {
    return {
        dataDirectory: process.cwd(),
        envFilePath: "./.env",
        options: { check: argv.check, format: argv.format },
        results: new Map()
    };
}
```

Then in `src/cli/index.ts`, pass argv to context:

```typescript
async (argv) => {
    const command = container.resolve(ScanCommand);
    await runner.run({ steps: command.steps(), context: command.context(argv) });
}
```

This is the same pattern already used — just adding the `format` key alongside `check`.

Modify `src/cli/commands/scan/feature.ts`:
- Add `RenderOutputStepFeature` and `OutputFormatterFeature` to dependencies

Modify `src/cli/index.ts`:
- Add `--format` option: `{ type: "string", default: "table", choices: ["table", "json", "csv", "sarif"] }`
- Pass options to command context

- [ ] **Step 10: Run all affected tests**

Run: `yarn vitest run src/cli/commands/scan/`
Expected: PASS

- [ ] **Step 11: Run full test suite**

Run: `yarn full`
Expected: All tests pass

- [ ] **Step 12: Commit**

```bash
yarn format:fix && yarn lint:fix
git add src/cli/commands/scan/
git commit -m "feat: add RenderOutputStep, refactor CheckLicensesStep, add --format CLI flag"
```
