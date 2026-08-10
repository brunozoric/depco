# CLI Integration Tests, IPackageEntry Consolidation, CSV Edge Cases

Date: 2026-08-10

## Task 1: E2E CLI Integration Tests

### Goal

Test the full 6-step scan pipeline end-to-end with real DI wiring, fixture lockfile, and mocked network calls.

### Fixture Setup

- Static `yarn.lock` fixture with ~5 known packages in `src/cli/commands/scan/__tests__/fixtures/`
- Paired `depco.config.ts` fixture with license policy (allowedRiskTiers, ignoredPackages) and vulnerability maxSeverity threshold
- Mock `globalThis.fetch` for npm registry license responses and OSV batch query responses
- Mock `child_process.execSync` for `npm audit` / `yarn audit` JSON output

### Test Cases

1. **License check, table format** (`--check license --format table`): full pipeline produces ANSI table with expected violations
2. **Vulnerability check, json format** (`--check vulnerability --format json`): JSON envelope with vulnerability findings
3. **All checks, csv format** (`--check all --format csv`): CSV rows for both license and vulnerability findings
4. **SARIF format** (`--format sarif`): valid SARIF 2.1.0 output with correct severity mappings
5. **Exit code 1 on license violations**: pipeline completes but RenderOutputStep signals exit code 1
6. **Exit code 1 on vulnerability severity threshold**: maxSeverity exceeded triggers exit code 1
7. **OSV graceful degradation**: OSV query throws, pipeline still completes with audit-only results

### Architecture

- Test file: `src/cli/commands/scan/__tests__/ScanPipeline.integration.test.ts`
- Wire real DI container via `ScanCommandFeature` composition
- Capture stdout via spy on `process.stdout.write` or `console.log`
- Assert on formatted output content and exit code signals

## Task 2: IPackageEntry Consolidation

### Goal

Eliminate 3 duplicate `IPackageEntry` definitions. Single source of truth in shared types.

### Changes

1. **Create** `src/shared/types/IPackageEntry.ts` with the canonical `IPackageEntry` interface (`name`, `version`)
2. **Update** `src/shared/vulnerabilities/abstractions/VulnerabilityMerger.ts`: import from shared types, re-export for backward compat via namespace
3. **Update** `src/cli/commands/scan/steps/CheckLicenses/CheckLicensesStep.ts`: delete local `IPackageEntry`, import from shared
4. **Update** `src/cli/commands/scan/steps/ParseLockfile/ParseLockfileStep.ts`: delete local `IPackageEntry`, import from shared
5. **Verify** all existing consumers still compile and tests pass

## Task 3: CSV escapeValue Edge Cases

### Goal

Fix `escapeValue` to handle bare `\r` per RFC 4180, and add thorough test coverage for CSV escaping.

### Implementation Fix

Current `escapeValue` checks for `,`, `"`, `\n` but misses `\r`. Add `\r` to the condition:

```typescript
if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
  return `"${value.replace(/"/g, '""')}"`;
}
```

### New Test Cases

1. **Bare `\r` in value**: triggers quoting
2. **Quote-doubling verification**: `He said "hello"` becomes `"He said ""hello"""`
3. **Newline in value**: `line1\nline2` becomes `"line1\nline2"`
4. **Combined special chars**: value with comma + quote + newline all at once
5. **Empty string passthrough**: empty string returns empty string unchanged
6. **`\r\n` (CRLF)**: triggers quoting via existing `\n` check but verify explicitly
