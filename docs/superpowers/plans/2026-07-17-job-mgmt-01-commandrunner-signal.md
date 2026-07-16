# Job Management 01 — CommandRunner AbortSignal + Service Threading

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional `AbortSignal` to CommandRunner and thread it through UpgradeService, PackageManagerService, and ScanService so callers can cancel running subprocesses.

**Architecture:** Add `signal?: AbortSignal` to option types in CommandRunner abstraction, pass it to execa. Each service that calls CommandRunner gains an optional `signal` last param, forwarded into the options object. All existing callers remain unchanged — `signal` is optional everywhere.

**Tech Stack:** execa (native AbortSignal support), TypeScript, Vitest

## Global Constraints

- TypeScript 7 strict, ESM
- DI via `@webiny/di` — abstractions in `abstractions/` dir, one file per token
- API tests: in-memory SQLite, real services, mock only `CommandRunner`
- Run `yarn full` after last task
- All `signal` params optional — no breaking changes to existing callers

---

### Task 1: CommandRunner — AbortSignal Support

**Files:**

- Modify: `src/api/services/abstractions/CommandRunner.ts:9-17` — add `signal?` to both option interfaces
- Modify: `src/api/services/CommandRunner.ts:11,34` — forward `signal` to execa options
- Test: `src/api/services/__tests__/CommandRunner.test.ts`

**Interfaces:**

- Consumes: nothing new
- Produces: `ICommandRunnerRunOptions.signal?: AbortSignal`, `ICommandRunnerStreamOptions.signal?: AbortSignal`

- [ ] **Step 1: Write failing test for signal abort in `run`**

Add to `src/api/services/__tests__/CommandRunner.test.ts`:

```typescript
it("aborts a running command when signal is triggered", async () => {
  const container = createContainer();
  container.register(CommandRunnerRegistration);
  const runner = container.resolve(CommandRunner);

  const controller = new AbortController();
  const promise = runner.run("sleep", ["10"], {
    cwd: process.cwd(),
    signal: controller.signal
  });

  controller.abort();
  const result = await promise;
  expect(result.exitCode).not.toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/api/services/__tests__/CommandRunner.test.ts`
Expected: FAIL — `signal` not recognized in options type

- [ ] **Step 3: Add `signal?` to abstraction option types**

In `src/api/services/abstractions/CommandRunner.ts`, add `signal?: AbortSignal` to both interfaces:

```typescript
export interface ICommandRunnerRunOptions {
  cwd: string;
  signal?: AbortSignal;
}

export interface ICommandRunnerStreamOptions {
  cwd: string;
  onStdout: (line: string) => void;
  onStderr: (line: string) => void;
  signal?: AbortSignal;
}
```

- [ ] **Step 4: Pass `signal` to execa in implementation**

In `src/api/services/CommandRunner.ts`, add `signal: options.signal` to both execa calls:

`run` method (line ~11):

```typescript
const result = await execa(command, args, {
  cwd: options.cwd,
  reject: false,
  signal: options.signal
});
```

`runStreaming` method (line ~34):

```typescript
const subprocess = execa(command, args, {
  cwd: options.cwd,
  reject: false,
  signal: options.signal
});
```

- [ ] **Step 5: Write failing test for signal abort in `runStreaming`**

```typescript
it("aborts a streaming command when signal is triggered", async () => {
  const container = createContainer();
  container.register(CommandRunnerRegistration);
  const runner = container.resolve(CommandRunner);

  const controller = new AbortController();
  const promise = runner.runStreaming("sleep", ["10"], {
    cwd: process.cwd(),
    onStdout: () => {},
    onStderr: () => {},
    signal: controller.signal
  });

  controller.abort();
  const result = await promise;
  expect(result.exitCode).not.toBe(0);
});
```

- [ ] **Step 6: Run all CommandRunner tests**

Run: `yarn test src/api/services/__tests__/CommandRunner.test.ts`
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/services/abstractions/CommandRunner.ts src/api/services/CommandRunner.ts src/api/services/__tests__/CommandRunner.test.ts
git commit -m "feat: add AbortSignal support to CommandRunner"
```

---

### Task 2: Service Signal Threading

**Files:**

- Modify: `src/api/services/abstractions/UpgradeService.ts:3-11` — add `signal?` to both methods
- Modify: `src/api/services/UpgradeService.ts:7-33` — accept and forward `signal`
- Modify: `src/api/services/abstractions/PackageManagerService.ts:11-16` — add `signal?` to `updateVersion`
- Modify: `src/api/services/PackageManagerService.ts:29-41` — forward `signal`
- Modify: `src/api/services/abstractions/ScanService.ts:12-18` — add `signal?` to `scan`
- Modify: `src/api/services/ScanService.ts` — forward `signal` through helpers and `scan`

**Interfaces:**

- Consumes: `CommandRunner.RunOptions.signal` / `CommandRunner.StreamOptions.signal` from Task 1
- Produces:
  - `UpgradeService.upgradePackage(path, name, version, onLog, signal?)`
  - `UpgradeService.refreshTransient(path, onLog, signal?)`
  - `PackageManagerService.updateVersion(path, pm, version, onLog, signal?)`
  - `ScanService.scan(path, pm, force, onProgress, signal?)`

- [ ] **Step 1: Add `signal?` to UpgradeService abstraction and implementation**

Abstraction (`src/api/services/abstractions/UpgradeService.ts`):

```typescript
export interface IUpgradeService {
  upgradePackage(
    projectPath: string,
    packageName: string,
    targetVersion: string,
    onLog: (line: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
  refreshTransient(
    projectPath: string,
    onLog: (line: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
}
```

Implementation (`src/api/services/UpgradeService.ts`) — add `signal?: AbortSignal` param to both methods, add `signal` to the runStreaming options object.

- [ ] **Step 2: Add `signal?` to PackageManagerService abstraction and implementation**

Abstraction — add `signal?: AbortSignal` as last param to `updateVersion`.

Implementation — accept `signal`, add it to the `runStreaming` options object.

- [ ] **Step 3: Add `signal?` to ScanService abstraction and implementation**

Abstraction — add `signal?: AbortSignal` as last param to `scan`.

Implementation — add `signal` param to `scan` method. Thread it through the helper functions `collectWorkspaces`, `collectInstalledVersions`, `collectDependencyTypes` as an optional last param, and forward into each `commandRunner.run` call's options object.

- [ ] **Step 4: Run existing tests to confirm no breakage**

Run: `yarn test src/api/services/__tests__/UpgradeService.test.ts src/api/services/__tests__/PackageManagerService.test.ts src/api/services/__tests__/ScanService.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/services/abstractions/UpgradeService.ts src/api/services/UpgradeService.ts src/api/services/abstractions/PackageManagerService.ts src/api/services/PackageManagerService.ts src/api/services/abstractions/ScanService.ts src/api/services/ScanService.ts
git commit -m "feat: thread AbortSignal through UpgradeService, PackageManagerService, ScanService"
```
