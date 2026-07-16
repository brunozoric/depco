# PR Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add push and PR creation as two new skippable steps in the upgrade wizard, supporting GitHub and GitLab via `@octokit/rest` and `@gitbeaker/rest`.

**Architecture:** Extends the existing step resolver pipeline with `PushResolver` (git push via CommandRunner) and `PrResolver` (forge detection + SDK-based PR creation). `ForgeService` abstraction handles GitHub/GitLab differences. Tokens stored in `app_settings`. UI adds two new wizard step components and a settings section for token/template config.

**Tech Stack:** `@octokit/rest` (GitHub API), `@gitbeaker/rest` (GitLab API), existing step resolver pipeline, Mantine UI

## Global Constraints

- All DI services follow `createAbstraction` / `createImplementation` pattern
- Abstractions and implementations MUST be in separate files, in separate directories
- Use yarn, not npm
- No inline structural types — always use named interfaces
- Tests use vitest, test DB helper at `src/testing/helpers/createTestDb.ts`
- Token keys: `github_token`, `gitlab_token` (snake_case, in `app_settings` table)
- Template keys: `pr_title_template`, `pr_body_template` (in `app_settings` table)
- Both new steps (`push`, `create-pr`) are skippable
- Build command: `yarn build` (not `yarn typecheck`)

---

### Task 1: GitService.push + ForgeService Abstraction + Implementation

**Files:**

- Modify: `src/api/services/abstractions/GitService.ts` (add `push` method + `IGitPushResult`)
- Modify: `src/api/services/GitService.ts` (implement `push`)
- Create: `src/api/services/abstractions/ForgeService.ts` (new abstraction)
- Create: `src/api/services/ForgeService.ts` (implementation with GitHub + GitLab drivers)
- Modify: `src/api/feature.ts` (register ForgeService)
- Modify: `package.json` (add `@octokit/rest`, `@gitbeaker/rest`)
- Test: `src/api/services/__tests__/GitService.test.ts` (add push tests)
- Test: `src/api/services/__tests__/ForgeService.test.ts` (new)

**Interfaces:**

- Consumes: `CommandRunner.Interface`, `DatabaseClient.Interface` (for token lookup), existing `IGitService`
- Produces: `IGitService.push(projectPath, remoteName, branchName): Promise<IGitPushResult>`, `IForgeService.detectForge(projectPath): Promise<ForgeType>`, `IForgeService.createPr(params: ICreatePrParams): Promise<IPrResult>`

- [ ] **Step 1: Install dependencies**

Run: `yarn add @octokit/rest @gitbeaker/rest`

- [ ] **Step 2: Add push to GitService abstraction**

In `src/api/services/abstractions/GitService.ts`, add:

```typescript
export interface IGitPushResult {
  success: boolean;
  output: string;
}
```

Add to `IGitService`:

```typescript
push(projectPath: string, remoteName: string, branchName: string): Promise<IGitPushResult>;
```

Add to namespace:

```typescript
export type PushResult = IGitPushResult;
```

- [ ] **Step 3: Write failing push test**

In `src/api/services/__tests__/GitService.test.ts`, add test:

```typescript
describe("push", () => {
  it("calls git push with correct arguments", async () => {
    mockCommandRunner.run.mockResolvedValueOnce({
      stdout: "Everything up-to-date",
      stderr: "",
      exitCode: 0
    });

    const result = await gitService.push("/test/project", "origin", "my-branch");

    expect(mockCommandRunner.run).toHaveBeenCalledWith(
      "git",
      ["push", "-u", "origin", "my-branch"],
      { cwd: "/test/project" }
    );
    expect(result.success).toBe(true);
  });

  it("returns failure when push fails", async () => {
    mockCommandRunner.run.mockResolvedValueOnce({
      stdout: "",
      stderr: "fatal: remote origin not found",
      exitCode: 128
    });

    const result = await gitService.push("/test/project", "origin", "my-branch");
    expect(result.success).toBe(false);
    expect(result.output).toContain("fatal: remote origin not found");
  });
});
```

- [ ] **Step 4: Implement push in GitService**

In `src/api/services/GitService.ts`, add to `GitServiceImpl`:

```typescript
public async push(
    projectPath: string,
    remoteName: string,
    branchName: string
): Promise<Abstraction.PushResult> {
    const result = await this.commandRunner.run(
        "git",
        ["push", "-u", remoteName, branchName],
        { cwd: projectPath }
    );

    if (result.exitCode !== 0) {
        return { success: false, output: result.stderr || result.stdout };
    }

    return { success: true, output: result.stdout || result.stderr };
}
```

- [ ] **Step 5: Run push tests**

Run: `yarn test src/api/services/__tests__/GitService.test.ts`
Expected: PASS

- [ ] **Step 6: Create ForgeService abstraction**

Create `src/api/services/abstractions/ForgeService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export type ForgeType = "github" | "gitlab" | "unknown";

export interface ICreatePrParams {
  projectPath: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

export interface IPrResult {
  url: string;
  number: number;
}

export interface IForgeService {
  detectForge(projectPath: string): Promise<ForgeType>;
  createPr(params: ICreatePrParams): Promise<IPrResult>;
}

export const ForgeService = createAbstraction<IForgeService>("Api/ForgeService");

export namespace ForgeService {
  export type Interface = IForgeService;
  export type Type = ForgeType;
  export type CreatePrParams = ICreatePrParams;
  export type PrResult = IPrResult;
}
```

- [ ] **Step 7: Write failing ForgeService tests**

Create `src/api/services/__tests__/ForgeService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ForgeServiceImpl } from "../ForgeService.js";
import type { CommandRunner } from "../abstractions/CommandRunner.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { appSettings } from "#api/db/schema.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

function createMockCommandRunner(): CommandRunner.Interface {
  return {
    run: vi.fn(),
    runStreaming: vi.fn()
  };
}

describe("ForgeService", () => {
  let db: TestDb;
  let commandRunner: CommandRunner.Interface;

  beforeEach(async () => {
    db = await createTestDb();
    commandRunner = createMockCommandRunner();
  });

  describe("detectForge", () => {
    it("detects GitHub from HTTPS URL", async () => {
      vi.mocked(commandRunner.run).mockResolvedValueOnce({
        stdout: "https://github.com/owner/repo.git",
        stderr: "",
        exitCode: 0
      });

      const service = new ForgeServiceImpl(commandRunner, { db } as DatabaseClient.Interface);
      const forge = await service.detectForge("/test");
      expect(forge).toBe("github");
    });

    it("detects GitHub from SSH URL", async () => {
      vi.mocked(commandRunner.run).mockResolvedValueOnce({
        stdout: "git@github.com:owner/repo.git",
        stderr: "",
        exitCode: 0
      });

      const service = new ForgeServiceImpl(commandRunner, { db } as DatabaseClient.Interface);
      const forge = await service.detectForge("/test");
      expect(forge).toBe("github");
    });

    it("detects GitLab from HTTPS URL", async () => {
      vi.mocked(commandRunner.run).mockResolvedValueOnce({
        stdout: "https://gitlab.com/group/project.git",
        stderr: "",
        exitCode: 0
      });

      const service = new ForgeServiceImpl(commandRunner, { db } as DatabaseClient.Interface);
      const forge = await service.detectForge("/test");
      expect(forge).toBe("gitlab");
    });

    it("returns unknown for other URLs", async () => {
      vi.mocked(commandRunner.run).mockResolvedValueOnce({
        stdout: "https://bitbucket.org/owner/repo.git",
        stderr: "",
        exitCode: 0
      });

      const service = new ForgeServiceImpl(commandRunner, { db } as DatabaseClient.Interface);
      const forge = await service.detectForge("/test");
      expect(forge).toBe("unknown");
    });
  });

  describe("parseRemoteUrl", () => {
    it("extracts owner/repo from HTTPS GitHub URL", () => {
      const result = ForgeServiceImpl.parseRemoteUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("extracts owner/repo from SSH GitHub URL", () => {
      const result = ForgeServiceImpl.parseRemoteUrl("git@github.com:owner/repo.git");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("extracts owner/repo from SSH GitLab URL", () => {
      const result = ForgeServiceImpl.parseRemoteUrl("git@gitlab.com:owner/repo.git");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("handles URLs without .git suffix", () => {
      const result = ForgeServiceImpl.parseRemoteUrl("https://github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("extracts project path from GitLab HTTPS URL", () => {
      const result = ForgeServiceImpl.parseRemoteUrl(
        "https://gitlab.com/group/subgroup/project.git"
      );
      expect(result).toEqual({
        owner: "group/subgroup",
        repo: "project"
      });
    });
  });

  describe("createPr", () => {
    it("throws when forge is unknown", async () => {
      vi.mocked(commandRunner.run).mockResolvedValue({
        stdout: "https://bitbucket.org/owner/repo.git",
        stderr: "",
        exitCode: 0
      });

      const service = new ForgeServiceImpl(commandRunner, { db } as DatabaseClient.Interface);

      await expect(
        service.createPr({
          projectPath: "/test",
          title: "PR",
          body: "",
          head: "feature",
          base: "main"
        })
      ).rejects.toThrow("Cannot detect git forge from remote URL");
    });

    it("throws when GitHub token is missing", async () => {
      vi.mocked(commandRunner.run).mockResolvedValue({
        stdout: "https://github.com/owner/repo.git",
        stderr: "",
        exitCode: 0
      });

      const service = new ForgeServiceImpl(commandRunner, { db } as DatabaseClient.Interface);

      await expect(
        service.createPr({
          projectPath: "/test",
          title: "PR",
          body: "",
          head: "feature",
          base: "main"
        })
      ).rejects.toThrow("GitHub token not configured");
    });

    it("throws when GitLab token is missing", async () => {
      vi.mocked(commandRunner.run).mockResolvedValue({
        stdout: "https://gitlab.com/owner/repo.git",
        stderr: "",
        exitCode: 0
      });

      const service = new ForgeServiceImpl(commandRunner, { db } as DatabaseClient.Interface);

      await expect(
        service.createPr({
          projectPath: "/test",
          title: "PR",
          body: "",
          head: "feature",
          base: "main"
        })
      ).rejects.toThrow("GitLab token not configured");
    });
  });
});
```

- [ ] **Step 8: Implement ForgeService**

Create `src/api/services/ForgeService.ts`:

```typescript
import { Octokit } from "@octokit/rest";
import { Gitlab } from "@gitbeaker/rest";
import { eq } from "drizzle-orm";
import { ForgeService as Abstraction } from "./abstractions/ForgeService.js";
import type { ForgeType } from "./abstractions/ForgeService.js";
import { CommandRunner } from "./abstractions/CommandRunner.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { appSettings } from "#api/db/schema.js";

interface IParsedRemote {
  owner: string;
  repo: string;
}

export class ForgeServiceImpl implements Abstraction.Interface {
  public constructor(
    private readonly commandRunner: CommandRunner.Interface,
    private readonly databaseClient: DatabaseClient.Interface
  ) {}

  public async detectForge(projectPath: string): Promise<ForgeType> {
    const result = await this.commandRunner.run("git", ["remote", "get-url", "origin"], {
      cwd: projectPath
    });

    const url = result.stdout.trim();

    if (url.includes("github.com")) {
      return "github";
    }
    if (url.includes("gitlab.com")) {
      return "gitlab";
    }
    return "unknown";
  }

  public async createPr(params: Abstraction.CreatePrParams): Promise<Abstraction.PrResult> {
    const remoteResult = await this.commandRunner.run("git", ["remote", "get-url", "origin"], {
      cwd: params.projectPath
    });
    const remoteUrl = remoteResult.stdout.trim();
    const forge = await this.detectForge(params.projectPath);
    if (forge === "unknown") {
      throw new Error("Cannot detect git forge from remote URL");
    }
    const parsed = ForgeServiceImpl.parseRemoteUrl(remoteUrl);

    if (forge === "github") {
      return this.createGitHubPr(parsed, params);
    }

    return this.createGitLabPr(parsed, remoteUrl, params);
  }

  private async createGitHubPr(
    parsed: IParsedRemote,
    params: Abstraction.CreatePrParams
  ): Promise<Abstraction.PrResult> {
    const token = await this.getToken("github_token");
    if (!token) {
      throw new Error("GitHub token not configured. Set it in Settings > Pull Requests.");
    }

    const octokit = new Octokit({ auth: token });
    const response = await octokit.pulls.create({
      owner: parsed.owner,
      repo: parsed.repo,
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base
    });

    return {
      url: response.data.html_url,
      number: response.data.number
    };
  }

  private async createGitLabPr(
    parsed: IParsedRemote,
    remoteUrl: string,
    params: Abstraction.CreatePrParams
  ): Promise<Abstraction.PrResult> {
    const token = await this.getToken("gitlab_token");
    if (!token) {
      throw new Error("GitLab token not configured. Set it in Settings > Pull Requests.");
    }

    let host: string;
    if (remoteUrl.includes("://")) {
      host = new URL(remoteUrl).origin;
    } else {
      const sshHostMatch = remoteUrl.match(/^git@([^:]+):/);
      host = sshHostMatch ? `https://${sshHostMatch[1]}` : "https://gitlab.com";
    }

    const projectPath = `${parsed.owner}/${parsed.repo}`;
    const gitlab = new Gitlab({ token, host });
    // Note: verify @gitbeaker/rest v40+ MergeRequests.create() signature at
    // implementation time — parameter order may differ between versions.
    // Check: https://github.com/jdalrymple/gitbeaker#merge-requests
    const mr = await gitlab.MergeRequests.create(
      projectPath,
      params.head,
      params.base,
      params.title,
      { description: params.body }
    );

    return {
      url: mr.web_url,
      number: mr.iid
    };
  }

  private async getToken(key: string): Promise<string | null> {
    const row = await this.databaseClient.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .get();

    return row?.value ?? null;
  }

  public static parseRemoteUrl(url: string): IParsedRemote {
    const cleaned = url.trim().replace(/\.git$/, "");

    const sshMatch = cleaned.match(/^git@[^:]+:(.+)$/);
    if (sshMatch) {
      const parts = sshMatch[1]!.split("/");
      const repo = parts.pop()!;
      const owner = parts.join("/");
      return { owner, repo };
    }

    const httpsMatch = cleaned.match(/https?:\/\/[^/]+\/(.+)$/);
    if (httpsMatch) {
      const parts = httpsMatch[1]!.split("/");
      const repo = parts.pop()!;
      const owner = parts.join("/");
      return { owner, repo };
    }

    throw new Error(`Cannot parse remote URL: ${url}`);
  }
}

export const ForgeService = Abstraction.createImplementation({
  implementation: ForgeServiceImpl,
  dependencies: [CommandRunner, DatabaseClient]
});
```

- [ ] **Step 9: Register ForgeService in API feature**

In `src/api/feature.ts`, add import and register. Place the registration AFTER `CommandRunner` and `DatabaseClient` registrations (ForgeService depends on both):

```typescript
import { ForgeService } from "./services/ForgeService.js";
// In register(), after container.register(ErrorReporter).inSingletonScope():
container.register(ForgeService).inSingletonScope();
```

- [ ] **Step 10: Run all tests**

Run: `yarn test src/api/services/__tests__/GitService.test.ts src/api/services/__tests__/ForgeService.test.ts`
Expected: PASS

- [ ] **Step 11: Verify build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add src/api/services/abstractions/GitService.ts src/api/services/GitService.ts src/api/services/abstractions/ForgeService.ts src/api/services/ForgeService.ts src/api/services/__tests__/GitService.test.ts src/api/services/__tests__/ForgeService.test.ts src/api/feature.ts package.json yarn.lock
git commit -m "feat(pr-creation): add GitService.push and ForgeService with GitHub/GitLab support"
```

---

### Task 2: Step Resolvers (PushResolver + PrResolver) + STEP_ORDER Update

**Files:**

- Modify: `src/api/services/stepResolvers/abstractions/StepResolver.ts` (add `"push"`, `"create-pr"` to `STEP_ORDER`)
- Create: `src/api/services/stepResolvers/PushResolver.ts`
- Create: `src/api/services/stepResolvers/PrResolver.ts`
- Modify: `src/api/feature.ts` (register resolvers in `StepResolverRegistryImpl`)
- Modify: `src/shared/templates/resolveTemplate.ts` (add `COUNT` and `PACKAGES_TABLE` tokens)
- Test: `src/api/services/stepResolvers/__tests__/PushResolver.test.ts`
- Test: `src/api/services/stepResolvers/__tests__/PrResolver.test.ts`

**Interfaces:**

- Consumes: `GitService.Interface` (push, getCurrentBranch), `ForgeService.Interface` (detectForge, createPr), `IStepContext`, `IStepResult`, `getNextStep`, `resolveTemplate`
- Produces: `PushResolver` (type: `"push"`, required: false), `PrResolver` (type: `"create-pr"`, required: false)

- [ ] **Step 1: Update STEP_ORDER**

In `src/api/services/stepResolvers/abstractions/StepResolver.ts`, change:

```typescript
export const STEP_ORDER = [
  "select-packages",
  "branch",
  "upgrade",
  "refresh-transient",
  "commit",
  "push",
  "create-pr"
] as const;
```

- [ ] **Step 2: Extend resolveTemplate with COUNT and PACKAGES_TABLE**

In `src/shared/templates/resolveTemplate.ts`, add `count` and `packagesTable` to `TemplateContext`:

```typescript
export interface TemplateContext {
  date?: Date;
  branch?: string;
  project?: string;
  count?: number;
  packagesTable?: string;
}
```

Add to the tokens map in `resolveTemplate()`:

```typescript
if (context.count !== undefined) {
  tokens["COUNT"] = String(context.count);
}
if (context.packagesTable !== undefined) {
  tokens["PACKAGES_TABLE"] = context.packagesTable;
}
```

- [ ] **Step 3: Write failing PushResolver tests**

Create `src/api/services/stepResolvers/__tests__/PushResolver.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { PushResolver } from "../PushResolver.js";
import type { GitService } from "../../abstractions/GitService.js";
import type { IStepContext, IStepState } from "../abstractions/StepResolver.js";

function createMockGitService(): GitService.Interface {
  return {
    getCurrentBranch: vi.fn().mockResolvedValue("main"),
    createAndCheckoutBranch: vi.fn(),
    getStatus: vi.fn(),
    stageAll: vi.fn(),
    commit: vi.fn(),
    push: vi.fn().mockResolvedValue({ success: true, output: "ok" })
  };
}

function createContext(steps: IStepState[]): IStepContext {
  return {
    steps,
    packageManager: "yarn",
    stepOrder: [
      "select-packages",
      "branch",
      "upgrade",
      "refresh-transient",
      "commit",
      "push",
      "create-pr"
    ]
  };
}

describe("PushResolver", () => {
  it("pushes branch from branch step result", async () => {
    const gitService = createMockGitService();
    const resolver = new PushResolver(gitService);

    const branchStep: IStepState = {
      type: "branch",
      status: "completed",
      input: {},
      result: { created: true, previousBranch: "main", currentBranch: "deps/upgrade" }
    };

    const result = await resolver.execute("/test", createContext([branchStep]), {});

    expect(gitService.push).toHaveBeenCalledWith("/test", "origin", "deps/upgrade");
    expect(result.updatedStep.status).toBe("completed");
    expect(result.updatedStep.result["branch"]).toBe("deps/upgrade");
  });

  it("uses getCurrentBranch when branch step was skipped", async () => {
    const gitService = createMockGitService();
    vi.mocked(gitService.getCurrentBranch).mockResolvedValue("feature-branch");
    const resolver = new PushResolver(gitService);

    const branchStep: IStepState = {
      type: "branch",
      status: "skipped",
      input: {},
      result: { created: false, previousBranch: "main", currentBranch: "main" }
    };

    const result = await resolver.execute("/test", createContext([branchStep]), {});

    expect(gitService.getCurrentBranch).toHaveBeenCalledWith("/test");
    expect(gitService.push).toHaveBeenCalledWith("/test", "origin", "feature-branch");
    expect(result.updatedStep.result["branch"]).toBe("feature-branch");
  });

  it("throws on push failure", async () => {
    const gitService = createMockGitService();
    vi.mocked(gitService.push).mockResolvedValue({
      success: false,
      output: "fatal: remote rejected"
    });
    const resolver = new PushResolver(gitService);

    const branchStep: IStepState = {
      type: "branch",
      status: "completed",
      input: {},
      result: { created: true, previousBranch: "main", currentBranch: "deps/upgrade" }
    };

    await expect(resolver.execute("/test", createContext([branchStep]), {})).rejects.toThrow(
      "fatal: remote rejected"
    );
  });
});
```

- [ ] **Step 4: Implement PushResolver**

Create `src/api/services/stepResolvers/PushResolver.ts`:

```typescript
import type { IStepResolver, IStepContext, IStepResult } from "./abstractions/StepResolver.js";
import { getNextStep } from "./abstractions/StepResolver.js";
import type { GitService } from "../abstractions/GitService.js";

export class PushResolver implements IStepResolver {
  public readonly type = "push";
  public readonly required = false;

  public constructor(private readonly gitService: GitService.Interface) {}

  public async execute(
    projectPath: string,
    context: IStepContext,
    input: Record<string, unknown>,
    _onProgress?: (log: string) => void
  ): Promise<IStepResult> {
    const branchStep = context.steps.find(s => s.type === "branch");
    let branchName: string;

    if (branchStep?.status === "completed" && branchStep.result["currentBranch"]) {
      branchName = String(branchStep.result["currentBranch"]);
    } else {
      branchName = await this.gitService.getCurrentBranch(projectPath);
    }

    const result = await this.gitService.push(projectPath, "origin", branchName);

    if (!result.success) {
      throw new Error(result.output);
    }

    return {
      updatedStep: {
        type: this.type,
        status: "completed",
        input,
        result: { remote: "origin", branch: branchName }
      },
      nextStep: getNextStep(this.type, context.stepOrder)
    };
  }
}
```

- [ ] **Step 5: Run PushResolver tests**

Run: `yarn test src/api/services/stepResolvers/__tests__/PushResolver.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing PrResolver tests**

Create `src/api/services/stepResolvers/__tests__/PrResolver.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { PrResolver } from "../PrResolver.js";
import type { ForgeService } from "../../abstractions/ForgeService.js";
import type { IStepContext, IStepState } from "../abstractions/StepResolver.js";

function createMockForgeService(): ForgeService.Interface {
  return {
    detectForge: vi.fn().mockResolvedValue("github"),
    createPr: vi.fn().mockResolvedValue({ url: "https://github.com/o/r/pull/1", number: 1 })
  };
}

function createContext(steps: IStepState[]): IStepContext {
  return {
    steps,
    packageManager: "yarn",
    stepOrder: [
      "select-packages",
      "branch",
      "upgrade",
      "refresh-transient",
      "commit",
      "push",
      "create-pr"
    ]
  };
}

function createStandardSteps(): IStepState[] {
  return [
    {
      type: "select-packages",
      status: "completed",
      input: { packages: [{ name: "lodash", targetVersion: "4.17.21" }] },
      result: {}
    },
    {
      type: "branch",
      status: "completed",
      input: {},
      result: { created: true, previousBranch: "main", currentBranch: "deps/upgrade" }
    },
    {
      type: "push",
      status: "completed",
      input: {},
      result: { remote: "origin", branch: "deps/upgrade" }
    }
  ];
}

describe("PrResolver", () => {
  it("creates PR with user-provided title and body", async () => {
    const forgeService = createMockForgeService();
    const resolver = new PrResolver(forgeService);

    const result = await resolver.execute("/test", createContext(createStandardSteps()), {
      title: "My PR",
      body: "Description"
    });

    expect(forgeService.createPr).toHaveBeenCalledWith({
      projectPath: "/test",
      title: "My PR",
      body: "Description",
      head: "deps/upgrade",
      base: "main"
    });
    expect(result.updatedStep.status).toBe("completed");
    expect(result.updatedStep.result["url"]).toBe("https://github.com/o/r/pull/1");
    expect(result.updatedStep.result["number"]).toBe(1);
  });

  it("auto-skips when push step was skipped", async () => {
    const forgeService = createMockForgeService();
    const resolver = new PrResolver(forgeService);

    const steps = createStandardSteps();
    steps[2] = { ...steps[2]!, status: "skipped", result: {} };

    const result = await resolver.execute("/test", createContext(steps), {});

    expect(result.updatedStep.status).toBe("skipped");
    expect(result.updatedStep.result["reason"]).toContain("Push step was skipped");
    expect(forgeService.createPr).not.toHaveBeenCalled();
  });

  it("throws when forge is unknown", async () => {
    const forgeService = createMockForgeService();
    vi.mocked(forgeService.detectForge).mockResolvedValue("unknown");
    const resolver = new PrResolver(forgeService);

    await expect(
      resolver.execute("/test", createContext(createStandardSteps()), { title: "PR", body: "" })
    ).rejects.toThrow("Cannot detect git forge from remote URL");
  });

  it("reads base branch from branch step previousBranch", async () => {
    const forgeService = createMockForgeService();
    const resolver = new PrResolver(forgeService);

    const steps = createStandardSteps();
    steps[1] = {
      type: "branch",
      status: "completed",
      input: {},
      result: { created: true, previousBranch: "develop", currentBranch: "deps/upgrade" }
    };

    await resolver.execute("/test", createContext(steps), { title: "PR", body: "" });

    expect(forgeService.createPr).toHaveBeenCalledWith(
      expect.objectContaining({ base: "develop" })
    );
  });
});
```

- [ ] **Step 7: Implement PrResolver**

Create `src/api/services/stepResolvers/PrResolver.ts`:

```typescript
import type { IStepResolver, IStepContext, IStepResult } from "./abstractions/StepResolver.js";
import { getNextStep } from "./abstractions/StepResolver.js";
import type { ForgeService } from "../abstractions/ForgeService.js";

export class PrResolver implements IStepResolver {
  public readonly type = "create-pr";
  public readonly required = false;

  public constructor(private readonly forgeService: ForgeService.Interface) {}

  public async execute(
    projectPath: string,
    context: IStepContext,
    input: Record<string, unknown>,
    _onProgress?: (log: string) => void
  ): Promise<IStepResult> {
    const pushStep = context.steps.find(s => s.type === "push");

    if (!pushStep || pushStep.status === "skipped") {
      return {
        updatedStep: {
          type: this.type,
          status: "skipped",
          input: {},
          result: {
            reason: "Push step was skipped — cannot create PR without a pushed branch."
          }
        },
        nextStep: getNextStep(this.type, context.stepOrder)
      };
    }

    const forge = await this.forgeService.detectForge(projectPath);
    if (forge === "unknown") {
      throw new Error("Cannot detect git forge from remote URL");
    }

    const branchStep = context.steps.find(s => s.type === "branch");
    // previousBranch is always recorded by BranchResolver (even when skipped).
    // Falls back to "main" only if branch step was never executed at all.
    const base = branchStep?.result["previousBranch"]
      ? String(branchStep.result["previousBranch"])
      : "main";

    const head = String(pushStep.result["branch"]);
    const title = String(input["title"] ?? "");
    const body = String(input["body"] ?? "");

    const result = await this.forgeService.createPr({
      projectPath,
      title,
      body,
      head,
      base
    });

    return {
      updatedStep: {
        type: this.type,
        status: "completed",
        input,
        result: { url: result.url, number: result.number }
      },
      nextStep: getNextStep(this.type, context.stepOrder)
    };
  }
}
```

- [ ] **Step 8: Register resolvers in API feature**

In `src/api/feature.ts`, import `PushResolver` and `PrResolver`. Add them to the `StepResolverRegistryImpl` constructor alongside the existing resolvers:

```typescript
import { PushResolver } from "./services/stepResolvers/PushResolver.js";
import { PrResolver } from "./services/stepResolvers/PrResolver.js";
import { ForgeService as ForgeServiceAbstraction } from "./services/abstractions/ForgeService.js";

// In register(), after resolving gitService and upgradeService:
const forgeService = container.resolve(ForgeServiceAbstraction);

container.registerInstance(
  StepResolverRegistry,
  new StepResolverRegistryImpl(
    new SelectPackagesResolver(),
    new BranchResolver(gitService),
    new UpgradeResolver(upgradeService),
    new RefreshTransientResolver(upgradeService),
    new CommitResolver(gitService),
    new PushResolver(gitService),
    new PrResolver(forgeService)
  )
);
```

- [ ] **Step 9: Run all resolver tests**

Run: `yarn test src/api/services/stepResolvers/__tests__/`
Expected: PASS

- [ ] **Step 10: Verify build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/api/services/stepResolvers/ src/shared/templates/resolveTemplate.ts src/api/feature.ts
git commit -m "feat(pr-creation): add PushResolver, PrResolver, and extend STEP_ORDER"
```

---

### Task 3: UI Wizard Components (PushStep + PrStep) + Settings Section

**Files:**

- Create: `src/ui/presentation/projects/UpgradeWizard/components/PushStep.tsx`
- Create: `src/ui/presentation/projects/UpgradeWizard/components/PrStep.tsx`
- Modify: `src/ui/presentation/projects/UpgradeWizard/components/UpgradeWizardPage.tsx` (add to `BUILT_IN_LABELS`, `renderStep`, imports)
- Create: `src/ui/presentation/settings/AppSettings/components/PrSettingsSection.tsx`
- Modify: `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx` (add section)
- Modify: `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts` (add `prTitleTemplate`, `prBodyTemplate` to ViewModel)
- Modify: `src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts` (load templates)

**Interfaces:**

- Consumes: `UpgradeWizardPresenter.Interface`, `resolveTemplate`, `SCAN_INTERVALS` pattern for settings, `AppSettingsGateway` for token CRUD
- Produces: `PushStep` component, `PrStep` component, `PrSettingsSection` component

- [ ] **Step 1: Add BUILT_IN_LABELS and renderStep entries**

In `src/ui/presentation/projects/UpgradeWizard/components/UpgradeWizardPage.tsx`:

Add to `BUILT_IN_LABELS`:

```typescript
push: "Push",
"create-pr": "Create PR"
```

Add imports for `PushStep` and `PrStep`.

Add cases to `renderStep()`:

```typescript
case "push":
    return <PushStep presenter={presenter} />;
case "create-pr":
    return <PrStep presenter={presenter} />;
```

- [ ] **Step 2: Create PushStep component**

Create `src/ui/presentation/projects/UpgradeWizard/components/PushStep.tsx`:

```tsx
import type React from "react";
import { useEffect } from "react";
import { Alert, Button, Code, Group, Loader, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface PushStepProps {
  presenter: UpgradeWizardPresenter.Interface;
}

export const PushStep = observer(function PushStep({ presenter }: PushStepProps): React.ReactNode {
  const { vm } = presenter;
  const step = vm.activeStep;

  useEffect(() => {
    if (step?.type === "push" && step.status === "active") {
      void presenter.executeStep("push", {});
    }
  }, [presenter, step?.type, step?.status]);

  const branchStep = vm.session?.steps.find(s => s.type === "branch");
  const branchName = branchStep?.result["currentBranch"] ?? "current branch";

  if (step?.status === "completed") {
    return (
      <Alert color="green" title="Pushed">
        <Text size="sm">
          Pushed {String(step.result["branch"])} to {String(step.result["remote"])}
        </Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Pushing branch {String(branchName)} to origin...
      </Text>

      {vm.loading && <Loader size="sm" />}

      {vm.stepLogs.length > 0 && (
        <Code block mah={300} style={{ overflow: "auto" }}>
          {vm.stepLogs.join("\n")}
        </Code>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={() => presenter.skipStep("push")} disabled={vm.loading}>
          Skip
        </Button>
      </Group>
    </Stack>
  );
});
```

- [ ] **Step 3: Add PR template fields to UpgradeWizardPresenter ViewModel**

In `src/ui/presentation/projects/UpgradeWizard/abstractions/UpgradeWizardPresenter.ts`, add to `IUpgradeWizardViewModel`:

```typescript
prTitleTemplate: string;
prBodyTemplate: string;
```

In `src/ui/presentation/projects/UpgradeWizard/UpgradeWizardPresenter.ts`, add default values and load them from app settings repository (same pattern as `branchTemplate` and `commitTemplate`).

- [ ] **Step 4: Create PrStep component**

Create `src/ui/presentation/projects/UpgradeWizard/components/PrStep.tsx`:

```tsx
import type React from "react";
import { useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { resolveTemplate } from "#shared/templates/resolveTemplate.js";
import type { UpgradeWizardPresenter } from "../abstractions/UpgradeWizardPresenter.js";

interface PrStepProps {
  presenter: UpgradeWizardPresenter.Interface;
}

interface ISelectedPackage {
  name: string;
  targetVersion: string;
  currentVersion?: string;
  upgradeType?: string;
}

function buildPackagesTable(packages: ISelectedPackage[]): string {
  const header = "| Package | From | To | Type |\n|---------|------|----|------|";
  const rows = packages.map(
    p =>
      `| ${p.name} | ${p.currentVersion ?? "?"} | ${p.targetVersion} | ${p.upgradeType ?? "unknown"} |`
  );
  return [header, ...rows].join("\n");
}

export const PrStep = observer(function PrStep({ presenter }: PrStepProps): React.ReactNode {
  const { vm } = presenter;
  const step = vm.activeStep;

  const selectPackagesStep = vm.session?.steps.find(s => s.type === "select-packages");
  const packages = (selectPackagesStep?.input["packages"] ?? []) as ISelectedPackage[];
  const packagesTable = buildPackagesTable(packages);

  const templateContext = {
    count: packages.length,
    packagesTable,
    project: vm.projectName
  };

  const [title, setTitle] = useState(() =>
    resolveTemplate(vm.prTitleTemplate || "chore(deps): upgrade ${COUNT} packages", templateContext)
  );
  const [body, setBody] = useState(() =>
    resolveTemplate(
      vm.prBodyTemplate ||
        "## Dependency Upgrades\n\n${PACKAGES_TABLE}\n\n_Generated by Dependency Manager on ${YYYY}-${MM}-${DD}_",
      templateContext
    )
  );

  const handleCreate = async (): Promise<void> => {
    await presenter.executeStep("create-pr", { title, body });
  };

  const handleSkip = async (): Promise<void> => {
    await presenter.skipStep("create-pr");
  };

  if (step?.status === "completed") {
    const prUrl = String(step.result["url"]);
    return (
      <Alert color="green" title="Pull Request Created">
        <Anchor href={prUrl} target="_blank" size="sm">
          {prUrl}
        </Anchor>
      </Alert>
    );
  }

  if (step?.status === "skipped" && step.result["reason"]) {
    return (
      <Alert color="yellow" title="Skipped">
        <Text size="sm">{String(step.result["reason"])}</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group gap="sm">
        <Text size="sm" c="dimmed">
          Create a pull request for the upgrade.
        </Text>
        <Badge size="sm" variant="light">
          {vm.session?.steps.find(s => s.type === "push")?.result["branch"]
            ? "Ready"
            : "Pending push"}
        </Badge>
      </Group>

      <TextInput
        label="PR Title"
        value={title}
        onChange={event => setTitle(event.currentTarget.value)}
      />

      <Textarea
        label="PR Body"
        value={body}
        onChange={event => setBody(event.currentTarget.value)}
        minRows={8}
        autosize
      />

      <Group justify="flex-end">
        <Button variant="default" onClick={handleSkip} disabled={vm.loading}>
          Skip
        </Button>
        <Button onClick={handleCreate} loading={vm.loading} disabled={title.length === 0}>
          Create Pull Request
        </Button>
      </Group>
    </Stack>
  );
});
```

- [ ] **Step 5: Create PrSettingsSection component**

Create `src/ui/presentation/settings/AppSettings/components/PrSettingsSection.tsx`:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { PasswordInput, Stack, Text, TextInput, Textarea, Button, Group } from "@mantine/core";
import { useContainer } from "../../../../shared/di/ContainerProvider.js";
import { AppSettingsGateway } from "../../../../features/appSettings/abstractions/AppSettingsGateway.js";
import { AppSettingsRepository } from "../../../../features/appSettings/abstractions/AppSettingsRepository.js";

interface IPrSettings {
  githubToken: string;
  gitlabToken: string;
  prTitleTemplate: string;
  prBodyTemplate: string;
}

const SETTING_KEYS = {
  githubToken: "github_token",
  gitlabToken: "gitlab_token",
  prTitleTemplate: "pr_title_template",
  prBodyTemplate: "pr_body_template"
} as const;

export function PrSettingsSection(): React.ReactNode {
  const container = useContainer();
  const gateway = container.resolve(AppSettingsGateway);
  const repository = container.resolve(AppSettingsRepository);

  const [settings, setSettings] = useState<IPrSettings>({
    githubToken: "",
    gitlabToken: "",
    prTitleTemplate: "",
    prBodyTemplate: ""
  });

  useEffect(() => {
    const stored = repository.getSettings();
    const get = (key: string): string => stored.find(s => s.key === key)?.value ?? "";

    setSettings({
      githubToken: get(SETTING_KEYS.githubToken),
      gitlabToken: get(SETTING_KEYS.gitlabToken),
      prTitleTemplate: get(SETTING_KEYS.prTitleTemplate),
      prBodyTemplate: get(SETTING_KEYS.prBodyTemplate)
    });
  }, [repository]);

  const save = async (key: string, value: string): Promise<void> => {
    const setting = await gateway.upsert(key, value);
    repository.upsertSetting(setting);
  };

  return (
    <Stack gap="md">
      <Text fw={600} size="sm">
        Pull Requests
      </Text>

      <PasswordInput
        label="GitHub Token"
        description="Personal access token for creating pull requests on GitHub"
        value={settings.githubToken}
        onChange={event =>
          setSettings(prev => ({ ...prev, githubToken: event.currentTarget.value }))
        }
        onBlur={() => void save(SETTING_KEYS.githubToken, settings.githubToken)}
      />

      <PasswordInput
        label="GitLab Token"
        description="Personal access token for creating merge requests on GitLab"
        value={settings.gitlabToken}
        onChange={event =>
          setSettings(prev => ({ ...prev, gitlabToken: event.currentTarget.value }))
        }
        onBlur={() => void save(SETTING_KEYS.gitlabToken, settings.gitlabToken)}
      />

      <TextInput
        label="PR Title Template"
        description="Tokens: ${COUNT}, ${DATE}, ${PROJECT}"
        placeholder="chore(deps): upgrade ${COUNT} packages"
        value={settings.prTitleTemplate}
        onChange={event =>
          setSettings(prev => ({ ...prev, prTitleTemplate: event.currentTarget.value }))
        }
        onBlur={() => void save(SETTING_KEYS.prTitleTemplate, settings.prTitleTemplate)}
      />

      <Textarea
        label="PR Body Template"
        description="Tokens: ${PACKAGES_TABLE}, ${COUNT}, ${DATE}, ${PROJECT}"
        placeholder="## Dependency Upgrades&#10;&#10;${PACKAGES_TABLE}"
        value={settings.prBodyTemplate}
        onChange={event =>
          setSettings(prev => ({ ...prev, prBodyTemplate: event.currentTarget.value }))
        }
        onBlur={() => void save(SETTING_KEYS.prBodyTemplate, settings.prBodyTemplate)}
        minRows={4}
        autosize
      />
    </Stack>
  );
}
```

- [ ] **Step 6: Wire PrSettingsSection into AppSettingsPage**

In `src/ui/presentation/settings/AppSettings/components/AppSettingsPage.tsx`, import `PrSettingsSection` and render it below the existing sections (same pattern as `ScanScheduleDefaultSection`).

- [ ] **Step 7: Run full test suite**

Run: `yarn test`
Expected: ALL PASS

- [ ] **Step 8: Verify build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/ui/presentation/projects/UpgradeWizard/ src/ui/presentation/settings/AppSettings/
git commit -m "feat(pr-creation): add PushStep, PrStep UI components and PR settings section"
```
