# CLI Scan Command Design

## Overview

Add `depco scan` as a standalone CLI command that runs on the current working directory without a server or database. Parses the lockfile, fetches license data from the npm registry, classifies risk tiers, and exits with code 1 if non-permissive licenses are found. Extensible with `--check` flags for future scan types (vulnerability, outdated).

## Usage

```bash
depco scan                    # runs all checks (license for now)
depco scan --check license    # explicit: license check only
npx @fundus/depco scan        # works as npx one-liner for CI
```

Exit codes: 0 = clean, 1 = violations found.

## Architecture

Follows existing CLI DI patterns (Command abstraction + Step abstraction). Standalone — no server, no database. Uses only:
- `LockfileParserService` (zero DI deps, pure file parser)
- `classifyLicenseRiskTier` from `#shared/licenses/` (pure function)
- Direct `fetch()` to npm registry (no RegistryCacheService, no DB cache)

## Directory Structure

```
src/cli/commands/scan/
  abstractions/
    ScanCommand.ts              — createAbstraction<Command.Interface>("Cli/ScanCommand")
    index.ts
  ScanCommand.ts                — ScanCommandImpl, composes scan steps
  feature.ts                    — ScanCommandFeature
  index.ts
  steps/
    DetectPackageManager/
      abstractions/
        DetectPackageManagerStep.ts
        index.ts
      DetectPackageManagerStep.ts
      feature.ts
      index.ts
    ParseLockfile/
      abstractions/
        ParseLockfileStep.ts
        index.ts
      ParseLockfileStep.ts
      feature.ts
      index.ts
    CheckLicenses/
      abstractions/
        CheckLicensesStep.ts
        index.ts
      CheckLicensesStep.tsx
      feature.ts
      index.ts
```

## Steps

### 1. DetectPackageManager

Checks cwd for lockfiles to determine package manager:
- `yarn.lock` → yarn
- `package-lock.json` → npm
- `pnpm-lock.yaml` → pnpm
- `bun.lock` or `bun.lockb` → bun

Stores result in `context.results.set("packageManager", pm)`. Fails if no lockfile found.

### 2. ParseLockfile

Uses `LockfileParserService.parse(cwd, packageManager)` to get all dependency edges. Extracts unique packages with versions. Stores in `context.results.set("packages", packages)` as `Array<{ name: string; version: string }>`.

LockfileParserService has zero DI dependencies — registered via a lightweight feature for this command only. Reuses existing parser from `src/api/services/DependencyGraph/`.

### 3. CheckLicenses

For each package:
1. Fetch license from npm registry via `fetch("https://registry.npmjs.org/<name>/<version>")`
2. Extract `license` field from response
3. Classify via `classifyLicenseRiskTier(spdxId)` from `#shared/licenses/types.js`
4. Collect violations (non-permissive: weak-copyleft, copyleft, proprietary, unknown)

Concurrency: batch requests (10 concurrent, matching existing ScanService pattern).

Output to console:
```
Scanning 245 packages...

✗ 3 license violations found:

  Package              License    Risk Tier
  ──────────────────── ────────── ──────────
  react-scripts        MIT        permissive  (ok)
  some-gpl-package     GPL-3.0    copyleft    ✗
  proprietary-lib      UNLICENSED proprietary ✗
  unknown-pkg          UNKNOWN    unknown     ✗

3 non-permissive licenses. Run with --allow-risk=weak-copyleft to relax.
```

Exit code 1 if any violations. Exit code 0 if all permissive.

## StepContext for Scan

```typescript
interface IScanStepContext extends IStepContext {
    // Standard fields inherited: dataDirectory, envFilePath, options, results
    // results map keys:
    //   "packageManager" → string (from DetectPackageManager)
    //   "packages" → Array<{ name: string; version: string }> (from ParseLockfile)
    //   "violations" → Array<ILicenseViolation> (from CheckLicenses)
}
```

Uses existing `IStepContext` — no new interface needed. Step data flows through `context.results` Map.

## Yargs Registration

```typescript
cli = cli.command("scan", "Scan current directory for dependency issues", yargs => {
    return yargs.option("check", {
        type: "string",
        description: "Check to run (license)",
        default: "license"
    });
}, async argv => {
    const command = container.resolve(ScanCommand);
    const context = command.context();
    context.options["check"] = argv.check;
    await runner.run({ steps: command.steps(), context });
});
```

## DI Wiring

ScanCommandFeature depends on:
- StepRunnerFeature (from existing runner)
- DetectPackageManagerStepFeature
- ParseLockfileStepFeature (registers LockfileParserService from DependencyGraph)
- CheckLicensesStepFeature

CliFeature adds ScanCommandFeature to its dependencies.

ParseLockfileStep needs LockfileParserService — import its feature from `src/api/services/DependencyGraph/feature.js` and add as dependency. LockfileParserService has zero DI deps, so this is lightweight.

## No New Dependencies

All npm packages already in the project:
- `yargs` (added in CLI install feature)
- Native `fetch()` (Node 24+, no polyfill needed)
- `classifyLicenseRiskTier` from `#shared/licenses/`
- `LockfileParserService` from `#api/services/DependencyGraph/`

## Testing

- DetectPackageManager: temp dirs with different lockfiles, verify correct PM detection, verify error on no lockfile
- ParseLockfile: mock LockfileParserService, verify package list extraction
- CheckLicenses: mock fetch(), verify classification + violation detection + exit code
- ScanCommand: verify 3 steps in correct order

## Future Extension

Additional `--check` values (vulnerability, outdated) add new steps. ScanCommand.steps() filters by `context.options["check"]` value. Each check is its own step with its own feature.
