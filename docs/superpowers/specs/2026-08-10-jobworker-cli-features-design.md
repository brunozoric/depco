# JobWorker Fix + CLI Features Design

Date: 2026-08-10

## Task 1: JobWorker Silent Catch Blocks

### Goal

Add error logging to 2 empty catch blocks in `src/api/services/JobExecution/JobWorker.ts` at lines 153 and 190. These silently swallow DB write failures during job execution (log flushing and progress updates).

### Changes

In `JobWorker.ts`:

- Line 153: `catch {}` after `db.update(upgradeJobs).set({ logs })` — add `console.error("Failed to flush job logs to database:", error)`
- Line 190: `catch {}` after `db.update(upgradeJobs).set({ progress })` — add `console.error("Failed to write job progress to database:", error)`

Both catch blocks intentionally do not re-throw (these are best-effort DB writes during job execution — the job should continue even if the DB write fails). The fix adds visibility without changing control flow.

## Task 2: `depco config check` Command

### Goal

New CLI command that validates `depco.config.ts` without running a scan. Loads config from cwd, validates against `depcoConfigSchema`, reports success or Zod validation errors.

### Architecture

- New command directory: `src/cli/commands/configCheck/`
- Single step: `ValidateConfigStep` — loads and validates config file
- Registers in CLI via yargs `.command("config-check", ...)`

### Behavior

1. Look for `depco.config.ts` in current directory
2. If not found: print "No depco.config.ts found in current directory" and exit 0
3. If found: dynamic import, validate against `depcoConfigSchema`
4. If valid: print "depco.config.ts is valid" and exit 0
5. If invalid: print Zod error messages (formatted) and exit 1

### Implementation

Reuse the existing config loading pattern from `LoadConfigStep` (dynamic import via `pathToFileURL`). The Zod schema already exists at `src/shared/config/schema.ts`. The command is a single step — no pipeline needed, but use the step runner for consistency.

### Files

- Create: `src/cli/commands/configCheck/ConfigCheckCommand.ts`
- Create: `src/cli/commands/configCheck/abstractions/ConfigCheckCommand.ts`
- Create: `src/cli/commands/configCheck/abstractions/index.ts` — barrel re-export
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/ValidateConfigStep.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/abstractions/ValidateConfigStep.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/abstractions/index.ts` — barrel re-export
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/feature.ts`
- Create: `src/cli/commands/configCheck/steps/ValidateConfig/index.ts` — barrel re-export
- Create: `src/cli/commands/configCheck/feature.ts`
- Create: `src/cli/commands/configCheck/index.ts` — barrel re-export
- Modify: `src/cli/feature.ts` — add ConfigCheckCommandFeature
- Modify: `src/cli/index.ts` — register `config-check` command

## Task 3: `--output` Flag for Scan Command

### Goal

Add `--output <path>` option to `depco scan`. When set, write formatted output to file instead of stdout.

### Behavior

- `depco scan --format json --output results.json` — writes JSON to `results.json`
- `depco scan --format csv --output results.csv` — writes CSV to `results.csv`
- `depco scan --format sarif --output results.sarif` — writes SARIF to `results.sarif`
- `depco scan --format table --output results.txt` — writes table to file (including ANSI codes)
- `depco scan --format json` (no --output) — prints to stdout as before
- When `--output` is used: write formatted output to file, print a summary line to stdout ("Wrote 5 findings to results.json")
- Exit code behavior unchanged (still 1 on violations/threshold)

### Changes

- Modify: `src/cli/index.ts` — add `--output` option to scan command yargs config
- Modify: `src/cli/commands/scan/steps/RenderOutput/RenderOutputStep.ts` — read `context.options["output"]` and write to file when set, fall back to `console.log` otherwise. Use `writeFileSync` from `node:fs` (existing pattern from WriteEnvFileStep).

### Edge Cases

- Parent directory of output path doesn't exist: let `writeFileSync` throw (step runner catches and reports)
- Output path is a directory: let `writeFileSync` throw
- File already exists: overwrite silently (standard CLI behavior)
