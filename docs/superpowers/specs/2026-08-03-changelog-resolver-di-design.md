# Changelog Resolver DI Conversion Design

## Problem

`ChangelogService` and `ChangelogJobExecutor` manually instantiate three changelog resolvers (`GitHubReleasesResolver`, `ChangelogFileResolver`, `NpmReadmeResolver`) in their constructors. `ChangelogJobExecutor` is also a plain exported class, not using `createImplementation`. This violates the project convention that all services use DI.

## Solution

Convert all three changelog resolvers to `createImplementation` pattern. Inject them via `{ multiple: true }` binding on the existing `ChangelogResolver` abstraction. Convert `ChangelogJobExecutor` to `createImplementation`. Update `JobExecutorRegistry` to receive the pre-built executor as a dependency instead of manually constructing it.

## Changes

### Changelog resolvers (3 files)

Each resolver gets `createImplementation` export, class becomes private (no export):

**`src/api/services/changelogResolvers/GitHubReleasesResolver.ts`**

- Make class private, add `createImplementation` export
- Dependencies: `[CommandRunner]`

**`src/api/services/changelogResolvers/ChangelogFileResolver.ts`**

- Make class private, add `createImplementation` export
- Dependencies: `[CommandRunner]`

**`src/api/services/changelogResolvers/NpmReadmeResolver.ts`**

- Make class private, add `createImplementation` export
- Remove comment block (line 5-7)
- Dependencies: `[RegistryCacheService]`

### ChangelogJobExecutor conversion

**`src/api/services/jobExecutors/abstractions/ChangelogJobExecutor.ts`** (new file)

- Create `IChangelogJobExecutor` interface extending `JobExecutor.Interface`
- Create abstraction with `createAbstraction<IChangelogJobExecutor>("Api/ChangelogJobExecutor")`
- Namespace with `Interface` type alias (standard pattern)

**`src/api/services/jobExecutors/ChangelogJobExecutor.ts`**

- Make class private, add `createImplementation` export
- Constructor changes: receives `ChangelogResolver.Interface[]` via `{ multiple: true }` instead of `CommandRunner` and `RegistryCacheService`
- Dependencies: `[DatabaseClient, [ChangelogResolver, { multiple: true }], WebSocketBroadcaster]`
- Remove imports: `GitHubReleasesResolver`, `ChangelogFileResolver`, `NpmReadmeResolver`, `CommandRunner`, `RegistryCacheService`
- Remove manual resolver instantiation from constructor

### ChangelogService update

**`src/api/services/ChangelogService.ts`**

- Constructor changes: receives `ChangelogResolver.Interface[]` directly instead of `CommandRunner` and `RegistryCacheService`
- Dependencies: `[DatabaseClient, [ChangelogResolver, { multiple: true }]]`
- Remove imports: `GitHubReleasesResolver`, `ChangelogFileResolver`, `NpmReadmeResolver`, `CommandRunner`, `RegistryCacheService`
- Remove manual resolver instantiation from constructor

### JobExecutorRegistry update

**`src/api/services/jobExecutors/JobExecutorRegistry.ts`**

- Add `ChangelogJobExecutor` abstraction as dependency (receives pre-built instance)
- Remove `ChangelogJobExecutor` from manual construction in constructor
- Remove `CommandRunner` and `RegistryCacheService` from dependencies if no other executor needs them

Check if other executors use `CommandRunner` or `RegistryCacheService`:

- `CloneJobExecutor` uses `CommandRunner` — keep it
- `InstallJobExecutor` uses `CommandRunner` via `driverRegistry` — `CommandRunner` still needed
- `RegistryCacheService` — check if any other executor uses it; if not, remove from registry deps

### DI registration

**`src/api/feature.ts`**

- Register each resolver individually (before ChangelogService and JobExecutorRegistry):
  ```
  container.register(GitHubReleasesResolver);
  container.register(ChangelogFileResolver);
  container.register(NpmReadmeResolver);
  ```
- Register ChangelogJobExecutor (must be before JobExecutorRegistry)

### Tests

- Update `src/api/routes/__tests__/changelogs.test.ts` — mock setup for ChangelogJobExecutor may change due to DI
- Existing resolver unit tests (`GitHubReleasesResolver.test.ts`, `NpmReadmeResolver.test.ts`) should remain unchanged as they test resolvers directly
- Verify full test suite passes

## Non-changes

- `ChangelogResolver` abstraction interface (`abstractions/ChangelogResolver.ts`) — already exists, no changes needed
- Resolver logic — purely structural refactor, no behavior changes
- Other job executors in JobExecutorRegistry — stay manually constructed (separate refactor)
