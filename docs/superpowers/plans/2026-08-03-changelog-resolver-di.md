# Plan: Changelog Resolver DI Conversion

Spec: `docs/superpowers/specs/2026-08-03-changelog-resolver-di-design.md`

## Chunk 1 — Convert 3 resolvers to createImplementation (3 files)

### 1.1 `src/api/services/changelogResolvers/GitHubReleasesResolver.ts`

Make class private (remove `export` from class), add `createImplementation` export:

```typescript
import { ChangelogResolver as Abstraction } from "./abstractions/ChangelogResolver.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";

class GitHubReleasesResolverImpl implements Abstraction.Interface {
  // ... existing class body unchanged
}

export const GitHubReleasesResolver = Abstraction.createImplementation({
  implementation: GitHubReleasesResolverImpl,
  dependencies: [CommandRunner]
});
```

### 1.2 `src/api/services/changelogResolvers/ChangelogFileResolver.ts`

Same pattern:

```typescript
import { ChangelogResolver as Abstraction } from "./abstractions/ChangelogResolver.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";

class ChangelogFileResolverImpl implements Abstraction.Interface {
  // ... existing class body unchanged
}

export const ChangelogFileResolver = Abstraction.createImplementation({
  implementation: ChangelogFileResolverImpl,
  dependencies: [CommandRunner]
});
```

### 1.3 `src/api/services/changelogResolvers/NpmReadmeResolver.ts`

Same pattern, remove comment block (lines 5-7):

```typescript
import { ChangelogResolver as Abstraction } from "./abstractions/ChangelogResolver.js";
import { RegistryCacheService } from "../abstractions/RegistryCacheService.js";

class NpmReadmeResolverImpl implements Abstraction.Interface {
  // ... existing class body unchanged
}

export const NpmReadmeResolver = Abstraction.createImplementation({
  implementation: NpmReadmeResolverImpl,
  dependencies: [RegistryCacheService]
});
```

### Verify

Run `yarn build` — no type errors.

## Chunk 2 — Convert ChangelogJobExecutor to DI (2 files)

### 2.1 Create abstraction: `src/api/services/jobExecutors/abstractions/ChangelogJobExecutor.ts` (new file)

```typescript
import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IChangelogJobExecutor extends JobExecutor.Interface {}

export const ChangelogJobExecutor = createAbstraction<IChangelogJobExecutor>(
  "Api/ChangelogJobExecutor"
);

export namespace ChangelogJobExecutor {
  export type Interface = IChangelogJobExecutor;
}
```

### 2.2 Update `src/api/services/jobExecutors/ChangelogJobExecutor.ts`

- Rename class to `ChangelogJobExecutorImpl`, make private
- Import `ChangelogJobExecutor as Abstraction` from new abstraction file
- Import `ChangelogResolver` from `../changelogResolvers/abstractions/ChangelogResolver.js`
- Constructor receives `resolvers: ChangelogResolver.Interface[]` instead of `commandRunner` and `registryCacheService`
- Remove manual resolver instantiation from constructor — just assign `this.resolvers = resolvers`
- Remove imports: `GitHubReleasesResolver`, `ChangelogFileResolver`, `NpmReadmeResolver`, `CommandRunner`, `RegistryCacheService`
- Add `createImplementation` export:

```typescript
export const ChangelogJobExecutor = Abstraction.createImplementation({
  implementation: ChangelogJobExecutorImpl,
  dependencies: [DatabaseClient, [ChangelogResolver, { multiple: true }], WebSocketBroadcaster]
});
```

### Verify

Run `yarn build` — expect errors in JobExecutorRegistry (fixed in chunk 3).

## Chunk 3 — Update ChangelogService and JobExecutorRegistry (2 files)

### 3.1 `src/api/services/ChangelogService.ts`

- Constructor changes: receive `resolvers: ChangelogResolver.Interface[]` directly
- Remove imports: `GitHubReleasesResolver`, `ChangelogFileResolver`, `NpmReadmeResolver`, `CommandRunner`, `RegistryCacheService`
- Remove `import type { ChangelogResolver }` — already imported via abstraction
- Update `createImplementation` dependencies:

```typescript
export const ChangelogService = Abstraction.createImplementation({
  implementation: ChangelogServiceImpl,
  dependencies: [DatabaseClient, [ChangelogResolver, { multiple: true }]]
});
```

### 3.2 `src/api/services/jobExecutors/JobExecutorRegistry.ts`

- Import `ChangelogJobExecutor` abstraction (from `./abstractions/ChangelogJobExecutor.js`)
- Remove import of `ChangelogJobExecutor` class (from `./ChangelogJobExecutor.js`)
- Remove import of `RegistryCacheService`
- Add `changelogJobExecutor: ChangelogJobExecutor.Interface` as last constructor param
- Replace manual `new ChangelogJobExecutor(...)` in the `all` array with `changelogJobExecutor`
- Remove `registryCacheService` constructor param
- Remove `RegistryCacheService` from `dependencies` array
- Add `ChangelogJobExecutor` abstraction to `dependencies` array (at end, matching param order)

Constructor `all` array changes from:

```typescript
new ChangelogJobExecutor(
    databaseClient,
    commandRunner,
    registryCacheService,
    webSocketBroadcaster
),
```

To just:

```typescript
changelogJobExecutor,
```

### Verify

Run `yarn build` — no type errors.
Run `yarn test` — all green.

## Chunk 4 — DI registration and tests (2 files)

### 4.1 `src/api/feature.ts`

Register resolvers individually before ChangelogService and JobExecutorRegistry:

```typescript
import { GitHubReleasesResolver } from "./services/changelogResolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "./services/changelogResolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "./services/changelogResolvers/NpmReadmeResolver.js";
import { ChangelogJobExecutor } from "./services/jobExecutors/ChangelogJobExecutor.js";

// In register():
container.register(GitHubReleasesResolver);
container.register(ChangelogFileResolver);
container.register(NpmReadmeResolver);
container.register(ChangelogJobExecutor);
```

### 4.2 Update `src/api/routes/__tests__/changelogs.test.ts`

Test currently registers `CommandRunner` and `RegistryCacheService` which `ChangelogService` used to depend on. After refactor, `ChangelogService` depends on `[ChangelogResolver, { multiple: true }]`. Update test setup:

- Import the 3 resolver `createImplementation` exports
- Register them individually: `container.register(GitHubReleasesResolver)`, `container.register(ChangelogFileResolver)`, `container.register(NpmReadmeResolver)`
- Keep `CommandRunner` and `RegistryCacheService` registrations — resolvers still depend on them transitively
- `ChangelogService` registration stays the same (`container.register(ChangelogServiceReg).inSingletonScope()`)

### Verify

Run `yarn build` — no type errors.
Run `yarn test` — all 1639+ tests pass.
