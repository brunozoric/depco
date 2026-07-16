# License Compliance Scanning — Design Spec

## Overview

License compliance scanning detects and classifies licenses for all project dependencies, evaluates them against user-defined policy rules, and surfaces violations in a dedicated UI page plus integrated indicators on project detail and dashboard.

License data comes from two sources: npm registry metadata and `license-checker-rspack` (scans actual `node_modules`). A policy engine with global and project-scoped rules classifies each license as allowed, warned, or denied.

## Decisions

- **Data sources**: Registry metadata + `license-checker-rspack` (dedicated tool for thorough detection)
- **Risk classification**: Full policy engine with rules (allow/warn/deny), not fixed categories
- **Violation actions**: Flag + block upgrades (auto-fix PR gate), no notifications yet
- **Job execution**: Separate `LicenseScanJobExecutor`, auto-enqueued after dependency scan, also triggerable independently
- **Rule scope**: License + package + project targeting. Global rules with project-level overrides
- **UI**: Dedicated "Licenses" page + integrated indicators on project detail and dashboard

## Database Schema

### `licenses` table

One row per package per project, refreshed each license scan.

| Column      | Type                           | Notes                                                               |
| ----------- | ------------------------------ | ------------------------------------------------------------------- |
| id          | text PK                        | generated ID                                                        |
| projectId   | text FK → projects(id) CASCADE |                                                                     |
| packageName | text                           |                                                                     |
| licenseName | text                           | Human-readable, e.g. "MIT License"                                  |
| spdxId      | text nullable                  | Normalized SPDX identifier, e.g. "MIT", "Apache-2.0"                |
| source      | text                           | "registry" or "license-checker"                                     |
| riskTier    | text                           | "permissive", "weak-copyleft", "copyleft", "proprietary", "unknown" |
| licenseUrl  | text nullable                  | Link to license text                                                |
| scannedAt   | integer                        | epoch ms                                                            |
| **unique**  | (projectId, packageName)       | upsert on rescan                                                    |

### `license_policy_rules` table

User-defined rules evaluated against scanned licenses.

| Column         | Type                                    | Notes                                                               |
| -------------- | --------------------------------------- | ------------------------------------------------------------------- |
| id             | text PK                                 |                                                                     |
| action         | text                                    | "allow", "warn", "deny"                                             |
| licensePattern | text nullable                           | SPDX id or glob, e.g. "GPL-*", "AGPL-3.0". Null = match any license |
| packagePattern | text nullable                           | Package name or glob. Null = match any package                      |
| projectId      | text nullable FK → projects(id) CASCADE | Null = global rule                                                  |
| priority       | integer                                 | Higher priority wins on conflict                                    |
| reason         | text nullable                           | Why this rule exists                                                |
| createdAt      | integer                                 |                                                                     |
| updatedAt      | integer                                 |                                                                     |

### `license_violations` table

Computed each scan, links license to broken rule.

| Column      | Type                                       | Notes                               |
| ----------- | ------------------------------------------ | ----------------------------------- |
| id          | text PK                                    |                                     |
| licenseId   | text FK → licenses(id) CASCADE             |                                     |
| ruleId      | text FK → license_policy_rules(id) CASCADE |                                     |
| projectId   | text FK → projects(id) CASCADE             |                                     |
| packageName | text                                       | denormalized for query convenience  |
| action      | text                                       | "warn" or "deny"                    |
| scannedAt   | integer                                    |                                     |
| **unique**  | (licenseId, ruleId)                        | one violation per license-rule pair |

### Built-in risk tier mapping

Hardcoded in a shared constant (`src/shared/licenses/types.ts`), not a table. Used for `riskTier` classification:

```
permissive: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, Unlicense, CC0-1.0, 0BSD
weak-copyleft: LGPL-2.1, LGPL-3.0, MPL-2.0, EPL-1.0, EPL-2.0
copyleft: GPL-2.0, GPL-3.0, AGPL-3.0
proprietary: (no SPDX match or "UNLICENSED")
unknown: (unparseable or missing)
```

## Backend Services

### LicenseCheckerService

Abstraction + implementation following DI pattern.

- `scan(projectPath: string): Promise<LicenseRecord[]>` — shells out to `license-checker-rspack --json` via `CommandRunner`, parses JSON output
- Returns `{ packageName, licenseName, spdxId, licenseUrl }` per installed package
- Edge cases: dual licenses ("MIT OR Apache-2.0" stored as full expression, components evaluated independently), missing fields, UNLICENSED

### LicensePolicyService

Evaluates rules against scanned licenses.

- `evaluate(projectId: string, licenses: LicenseRecord[]): Promise<Violation[]>`
  1. Load all applicable rules: global (`projectId IS NULL`) + project-specific
  2. For each license, find matching rules (glob match on `licensePattern` and `packagePattern`)
  3. Sort matches by priority DESC; project-scoped beats global at same priority
  4. First match wins — "allow" = no violation, "warn"/"deny" = violation record
  5. No matching rule defaults to "allow"
- `getComplianceStatus(projectId: string): Promise<ComplianceStatus>` — summary counts
- `wouldViolate(projectId: string, packageName: string, newVersion: string): Promise<boolean>` — reserved interface for auto-fix PR gate (not implemented in this spec)

### LicenseScanJobExecutor

Registered in `JobExecutorRegistry` as type `"license-scan"`. Requires adding `"license-scan"` to the `ICreateJobInput` type union in `src/api/services/abstractions/JobWorker.ts` and registering the executor class in `JobExecutorRegistry`.

`execute()` flow:

1. Shell out to `license-checker-rspack` via `LicenseCheckerService`
2. Supplement with registry metadata from `scanResults` (for packages not in node_modules)
3. Classify risk tier using shared constant mapping
4. Upsert `licenses` table (delete stale where `scannedAt < currentScanTimestamp` + insert, same pattern as vulnerability scan)
5. Run `LicensePolicyService.evaluate()` — clear old violations for project, write new ones
6. Broadcast `license-scan:complete` via WebSocket

### ScanJobExecutor integration

ScanJobExecutor already emits `eventBus.emit("scan:completed", projectId)` at line 376. In `server.ts`, add a listener (same pattern as `scan:scheduled`):

```typescript
eventBus.on("scan:completed", (projectId: string) => {
  void jobWorker.enqueue({
    type: "license-scan",
    referenceId: projectId,
    referenceType: "project"
  });
});
```

JobWorker resolves project path and package manager from `referenceId` at execution time — no lookup needed in the listener. This keeps job executors decoupled.

## API Routes

### License data routes (`src/api/routes/licenses.ts`)

Routes with fixed path segments registered before parametrized routes to avoid shadowing (same pattern as vulnerability routes).

| Method | Path                            | Purpose                                                                     |
| ------ | ------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/api/licenses`                 | List all licenses. Filter: `projectId`, `riskTier`, `spdxId`, `packageName` |
| GET    | `/api/licenses/summary`         | Compliance summary: totals, counts per risk tier, violation counts          |
| GET    | `/api/licenses/:projectId`      | Licenses for one project                                                    |
| POST   | `/api/licenses/:projectId/scan` | Trigger manual license scan                                                 |

### Policy rule routes (`src/api/routes/licensePolicies.ts`)

| Method | Path                        | Purpose                             |
| ------ | --------------------------- | ----------------------------------- |
| GET    | `/api/license-policies`     | List all rules. Filter: `projectId` |
| POST   | `/api/license-policies`     | Create rule                         |
| PUT    | `/api/license-policies/:id` | Update rule                         |
| DELETE | `/api/license-policies/:id` | Delete rule (CASCADE to violations) |

### Violation routes (in `src/api/routes/licenses.ts`)

Violations are tightly coupled to licenses — kept in same route file.

| Method | Path                              | Purpose                                                       |
| ------ | --------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/license-violations`         | List violations. Filter: `projectId`, `action`, `packageName` |
| GET    | `/api/license-violations/summary` | Aggregate: total, warn/deny counts, per-project breakdown     |

### Shared route definitions

`src/shared/routes/licenses.ts` — Zod schemas for all request/response shapes using `defineRoute()`.

### WebSocket events

- `license-scan:progress` — `{ projectId, packageName, current, total }`
- `license-scan:complete` — `{ projectId, totalLicenses, violations }`

## UI Architecture

Follows Gateway → Repository → UseCase → Presenter → React pattern.

### Dedicated Licenses Page (`/licenses`)

- **LicensesGateway** — HTTP calls to license, policy, and violation routes
- **LicensesRepository** — stores license list, violations, policy rules, compliance summary
- **LoadLicensesUseCase** — fetches licenses + violations + summary
- **ManagePolicyRulesUseCase** — CRUD for policy rules
- **ScanLicensesUseCase** — triggers license scan per project
- **LicensesPresenter** — computes view model:
  - License table: package, license, SPDX, risk tier, project, violation status
  - Filters: risk tier, project, violation action, search by package name
  - Sort: package name, risk tier, violation severity
  - Policy rule management panel (list, add, edit, delete)
  - Compliance summary stats at top

### Project Detail Integration

- `ProjectDetailPresenter` gains `licenseByPackage` map (fetched in `load()`)
- `DependencyViewModel` extended: `license: string | null`, `licenseRiskTier: string | null`
- Compliance badge on project header (green/yellow/red based on deny/warn count)
- License column in dependency table with risk tier color coding

### Dashboard Integration

- "License Compliance" card widget:
  - Total packages scanned, compliant %, deny violations count
  - Mini bar chart by risk tier
  - Worst-compliance projects list
- `DashboardGateway.getLicenseSummary()` method
- `DashboardRepository` gains license summary storage
- `DashboardPresenter` gains license compliance view model section

### Navigation

"Licenses" nav item in sidebar, after Vulnerabilities.

## Error Handling & Edge Cases

- **`license-checker-rspack` fails**: Falls back to registry-only data, logs warning via `ErrorReporter`
- **Package not in `node_modules`**: Supplemented from registry metadata in `scanResults`
- **Unparseable SPDX**: Stored as-is in `licenseName`, `spdxId` = null, `riskTier` = "unknown"
- **No matching rules**: License is allowed (no violation)
- **No license detected**: `licenseName` = "UNKNOWN", `riskTier` = "unknown", evaluated against rules normally
- **Dual/multi-license** (`MIT OR GPL-3.0`): Full expression in `licenseName`, each component evaluated independently, most permissive result wins (OR semantics)
- **Rule deleted**: CASCADE deletes associated violations
- **Project deleted**: CASCADE on `projectId` cleans licenses, violations, project-scoped rules
- **License scan failure**: Does NOT fail parent dependency scan (catch + log)
- **Concurrent scans**: Last-write-wins via upsert
- **Empty `node_modules`**: Zero licenses returned, UI shows "No license data — run install first"

## Auto-Fix PR Gate (Future)

`LicensePolicyService.wouldViolate()` — interface contract reserved for auto-fix PR feature. When implemented, auto-fix PRs will call this before upgrading a package to verify the new version's license doesn't violate policy. Not implemented in this spec.

## Testing Strategy

### Unit tests

- **LicenseCheckerService**: Mock `CommandRunner`, test JSON parsing, edge cases (dual licenses, missing fields, UNLICENSED, empty node_modules)
- **LicensePolicyService**: Rule matching logic — global vs project-scoped, priority tie-breaking, glob patterns, package exemptions, no-rule-defaults-to-allow, multiple rules highest priority wins
- **LicenseScanJobExecutor**: Mock services + DB, verify upsert logic, stale deletion, violation generation, WebSocket broadcast
- **Risk tier classification**: Shared constant mapping, SPDX normalization, unknown handling

### Presenter tests

- **LicensesPresenter**: Filter combinations, sort orders, compliance summary computation, policy rule CRUD state
- **ProjectDetailPresenter**: License column data, compliance badge logic
- **DashboardPresenter**: License compliance widget view model

### Integration tests

- Route handlers with real SQLite in-memory DB — CRUD lifecycle for policy rules, license scan trigger + result verification
- End-to-end scan flow: enqueue → executor → licenses persisted → violations computed → summary correct

No mocks for DB — real SQLite in-memory, following project convention.
