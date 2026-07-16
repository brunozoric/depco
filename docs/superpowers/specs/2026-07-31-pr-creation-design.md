# PR Creation Design

## Overview

Add push and pull request creation as two new steps in the upgrade wizard. After committing dependency upgrades, users can push the branch and create a PR on GitHub or GitLab. Uses `@octokit/rest` for GitHub and `@gitbeaker/rest` for GitLab, with personal access tokens stored in app settings. PR body is auto-generated from upgrade data and editable before submission.

## Forge Service

### Abstraction

`ForgeService` in `src/api/services/abstractions/ForgeService.ts`:

```typescript
interface IForgeService {
  detectForge(projectPath: string): Promise<ForgeType>;
  createPr(params: ICreatePrParams): Promise<IPrResult>;
}

type ForgeType = "github" | "gitlab" | "unknown";

interface ICreatePrParams {
  projectPath: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

interface IPrResult {
  url: string;
  number: number;
}
```

### Forge Detection

Parse `git remote get-url origin` via `CommandRunner`:

- Contains `github.com` -> `"github"`
- Contains `gitlab.com` -> `"gitlab"`
- Otherwise -> `"unknown"`

Custom domain matching is out of scope for v1. Users with self-hosted forges on custom domains get `"unknown"` and can't use PR creation until domain mapping is added.

### GitHub Driver

Uses `@octokit/rest` with token from `app_settings` key `github_token`.

Extracts owner/repo from remote URL (handles both HTTPS `github.com/owner/repo.git` and SSH `git@github.com:owner/repo.git` formats).

Calls `octokit.pulls.create({ owner, repo, title, body, head, base })`.

### GitLab Driver

Uses `@gitbeaker/rest` with token from `app_settings` key `gitlab_token`.

Extracts project path from remote URL.

Creates merge request via `new Gitlab({ token, host }).MergeRequests.create(projectId, head, base, title, { description: body })`. Note: verify exact `@gitbeaker/rest` v40+ API signature at implementation time — parameter order may differ between versions.

### Token Storage

Two new keys in existing `app_settings` table:

- `github_token` — GitHub personal access token
- `gitlab_token` — GitLab personal access token

No new DB tables. Tokens stored as plaintext in SQLite, consistent with other app settings. This is a local dev tool, not a multi-user service.

## Git Push

Push is handled by `GitService`, not `ForgeService`. New method added to `IGitService` in `src/api/services/abstractions/GitService.ts` (which currently has `getCurrentBranch`, `createAndCheckoutBranch`, `getStatus`, `stageAll`, `commit` — no `push` yet):

```typescript
push(projectPath: string, remoteName: string, branchName: string): Promise<IGitPushResult>;
```

New interface `IGitPushResult`:

```typescript
interface IGitPushResult {
  success: boolean;
  output: string;
}
```

Implementation in `src/api/services/GitService.ts`: `CommandRunner.run("git", ["push", "-u", remoteName, branchName], { cwd: projectPath })`.

No SDK needed for push — git CLI handles auth via existing credential helpers or SSH keys.

## Upgrade Wizard Steps

### Updated Step Order

```typescript
const STEP_ORDER = [
  "select-packages",
  "branch",
  "upgrade",
  "refresh-transient",
  "commit",
  "push",
  "create-pr"
] as const;
```

Both new steps are skippable.

`STEP_ORDER` is defined in `src/api/services/stepResolvers/abstractions/StepResolver.ts`. The `createDefaultSteps()` function and `StepType` type alias also need updating. The `UpgradeWizardPage.tsx` component's `renderStep()` switch and `BUILT_IN_LABELS` map need entries for `"push"` and `"create-pr"`.

### PushResolver

New step resolver in `src/api/services/stepResolvers/PushResolver.ts`.

**Inputs:** None required from user.

**Behavior:**

1. Read branch name from `branch` step result (`branchName`). If branch step was skipped, call `GitService.getCurrentBranch()`.
2. Call `GitService.push(projectPath, "origin", branchName)`.
3. On success, return result `{ remote: "origin", branch: branchName }`.
4. On failure, throw with the git error output.

**Skippable:** Yes. User may want to push manually or push to a different remote.

### PrResolver

New step resolver in `src/api/services/stepResolvers/PrResolver.ts`.

**Inputs from user:** `{ title: string, body: string }` (pre-filled with auto-generated values, editable).

**Behavior:**

1. Detect forge from remote URL via `ForgeService.detectForge()`.
2. If forge is `"unknown"`, throw `"Cannot detect git forge from remote URL"`.
3. Read base branch: call `GitService.getCurrentBranch()` on the project BEFORE the branch step created a new one. Since branch step records the original branch, read it from `branch` step result `{ previousBranch }`. If branch step was skipped, use current branch's upstream tracking branch or default to `"main"`.
4. Read head branch from `push` step result.
5. Call `ForgeService.createPr({ projectPath, title, body, head, base })`.
6. Return result `{ url, number }`.

**Skippable:** Yes.

**Guard:** If push step was skipped (`context.steps.find(s => s.type === "push")?.status === "skipped"`), PrResolver returns immediately with `{ updatedStep: { type: "create-pr", status: "skipped", input: {}, result: { reason: "Push step was skipped — cannot create PR without a pushed branch." } }, nextStep: null }`. This follows the same pattern as `CustomStepResolver`'s non-required skip.

### Auto-Generated PR Content

**Title template:** Stored in `app_settings` as `pr_title_template`. Default: `"chore(deps): upgrade ${COUNT} packages"`.

Tokens:

- `${COUNT}` — number of packages from `select-packages` step input array length (`(selectPackagesStep.input["packages"] as ISelectedPackage[]).length`)
- `${DATE}` — current date formatted as `YYYY-MM-DD`
- `${PROJECT}` — project name from the project record

Token resolution uses existing `resolveTemplate()` from `#shared/templates/resolveTemplate.js` (already used by BranchStep and CommitStep).

**Body template:** Stored in `app_settings` as `pr_body_template`. Default:

```markdown
## Dependency Upgrades

${PACKAGES_TABLE}

_Generated by Dependency Manager on ${DATE}_
```

`${PACKAGES_TABLE}` renders a markdown table:

```markdown
| Package | From    | To      | Type  |
| ------- | ------- | ------- | ----- |
| lodash  | 4.17.20 | 4.17.21 | patch |
| react   | 17.0.2  | 18.2.0  | major |
```

Package data comes from `select-packages` step input.

## UI Components

### PushStep.tsx

Auto-executes when active (same pattern as `UpgradeStep`). Shows:

- "Pushing branch {name} to origin..." while running
- Success: "Pushed to origin/{branch}"
- Failure: error message
- Skip button

### PrStep.tsx

Interactive step (same pattern as `CommitStep`/`BranchStep`). Shows:

- Detected forge badge ("GitHub" / "GitLab" / "Unknown")
- Editable title input (pre-filled from template)
- Editable body textarea (pre-filled from template with package table)
- "Create Pull Request" button + "Skip" button
- After creation: PR URL as clickable link

### Settings UI

Add "Pull Requests" section to App Settings page (same approach as scan schedule — standalone component, not in KNOWN_SETTINGS, since tokens need password masking).

Fields:

- GitHub Token (password input)
- GitLab Token (password input)
- PR Title Template (text input)
- PR Body Template (textarea)

## BranchResolver Update

`BranchResolver` must record `previousBranch` in its result so `PrResolver` knows the base branch:

```typescript
result: { branchName, previousBranch: currentBranch }
```

When branch creation is skipped, still record `{ previousBranch: currentBranch }`.

## Dependencies

New npm packages:

- `@octokit/rest` — GitHub REST API client
- `@gitbeaker/rest` — GitLab REST API client

## Testing

- `ForgeService` unit tests: forge detection from various URL formats (HTTPS, SSH, custom), `createPr` calls for GitHub and GitLab (mock SDK clients)
- `PushResolver` unit tests: reads branch from prior step, calls GitService.push, handles failure
- `PrResolver` unit tests: detects forge, generates PR content from template + package data, calls ForgeService.createPr
- `GitService.push` unit tests: delegates to CommandRunner
- Route/settings integration tests for token CRUD
- UI presentation tests for PrStep form state
