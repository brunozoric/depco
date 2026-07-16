# Job Management 04 — UI Jobs Gateway + Repository

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the headless UI feature layer for jobs — Gateway (HTTP calls) and Repository (in-memory state).

**Architecture:** Follow existing pattern from `src/ui/features/settings/`. Gateway calls `listAllJobsRoute` and `cancelJobRoute` via `HTTPClient`. Repository holds `IJob[]` with get/set/updateStatus.

**Tech Stack:** @webiny/di, HTTPClient abstraction

## Global Constraints

- TypeScript 7 strict, ESM
- Abstractions in `abstractions/` dir, one file per token
- Barrel exports: only abstractions and features
- `Impl` suffix only on class declaration
- DI feature registers both Gateway and Repository as singletons

---

### Task 1: Jobs Gateway + Repository + Feature

**Files:**

- Create: `src/ui/features/jobs/abstractions/JobsGateway.ts`
- Create: `src/ui/features/jobs/JobsGateway.ts`
- Create: `src/ui/features/jobs/abstractions/JobsRepository.ts`
- Create: `src/ui/features/jobs/JobsRepository.ts`
- Create: `src/ui/features/jobs/abstractions/index.ts`
- Create: `src/ui/features/jobs/index.ts`
- Create: `src/ui/features/jobs/feature.ts`

**Interfaces:**

- Consumes: `listAllJobsRoute`, `cancelJobRoute` from plan 03; `HTTPClient` abstraction
- Produces:
  - `IJobsGateway.listAll(status?: string): Promise<IJob[]>`
  - `IJobsGateway.cancel(jobId: string): Promise<void>`
  - `IJobsRepository.getJobs(): IJob[]`
  - `IJobsRepository.setJobs(jobs: IJob[]): void`
  - `IJobsRepository.updateJobStatus(id: string, status: string): void`
  - `JobsFeature`

- [ ] **Step 1: Create JobsGateway abstraction**

`src/ui/features/jobs/abstractions/JobsGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IJob {
  id: string;
  projectId: string;
  type: string;
  status: string;
  packages: string | null;
  logs: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface IJobsGateway {
  listAll(status?: string): Promise<IJob[]>;
  cancel(jobId: string): Promise<void>;
}

export const JobsGateway = createAbstraction<IJobsGateway>("Ui/JobsGateway");

export namespace JobsGateway {
  export type Interface = IJobsGateway;
  export type Job = IJob;
}
```

- [ ] **Step 2: Create JobsGateway implementation**

`src/ui/features/jobs/JobsGateway.ts` — HTTPClient-based, calls `listAllJobsRoute` (maps items via `toJob`) and `cancelJobRoute`.

- [ ] **Step 3: Create JobsRepository abstraction**

`src/ui/features/jobs/abstractions/JobsRepository.ts` — `getJobs`, `setJobs`, `updateJobStatus`. Uses `JobsGateway.Job` type alias.

- [ ] **Step 4: Create JobsRepository implementation**

`src/ui/features/jobs/JobsRepository.ts` — plain class, stores `IJob[]`, `updateJobStatus` maps over array replacing matching id.

- [ ] **Step 5: Create barrel exports and feature**

`src/ui/features/jobs/abstractions/index.ts`:

```typescript
export { JobsGateway } from "./JobsGateway.js";
export { JobsRepository } from "./JobsRepository.js";
```

`src/ui/features/jobs/index.ts`:

```typescript
export { JobsGateway } from "./abstractions/index.js";
export { JobsRepository } from "./abstractions/index.js";
export { JobsFeature } from "./feature.js";
```

`src/ui/features/jobs/feature.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { JobsGateway } from "./JobsGateway.js";
import { JobsRepository } from "./JobsRepository.js";

export const JobsFeature = createFeature({
  name: "Ui/Jobs",
  register(container: Container) {
    container.register(JobsGateway).inSingletonScope();
    container.register(JobsRepository).inSingletonScope();
  }
});
```

- [ ] **Step 6: Run build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/features/jobs/
git commit -m "feat: add UI Jobs feature — Gateway and Repository"
```
