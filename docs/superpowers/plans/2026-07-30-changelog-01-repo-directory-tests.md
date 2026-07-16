# Repo Directory Test Coverage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add test coverage for `normalizeRepoUrl()`, `extractRepoDirectory()`, and ChangelogFileResolver `repoDirectory` path priority.

**Architecture:** Pure function unit tests (no DI) for normalizeRepoUrl helpers. Mock-based tests for ChangelogFileResolver following existing test patterns.

**Tech Stack:** Vitest, CommandRunner mock pattern

## Global Constraints

- Test runner: Vitest (config in `testing/vitest.config.ts`)
- Run tests: `yarn test`
- Formatter: oxfmt (`yarn format:fix`)
- Linter: oxlint (`yarn lint`)
- Path aliases: `#api/*`, `#shared/*`, `#testing/*`

---

### Task 1: normalizeRepoUrl and extractRepoDirectory unit tests

**Files:**

- Create: `src/api/services/packageManagers/__tests__/normalizeRepoUrl.test.ts`
- Reference: `src/api/services/packageManagers/normalizeRepoUrl.ts`

**Interfaces:**

- Consumes: `normalizeRepoUrl(repository: unknown): string | null`, `extractRepoDirectory(repository: unknown): string | null`
- Produces: Nothing — pure test file

- [ ] **Step 1: Write all normalizeRepoUrl tests**

```typescript
import { describe, it, expect } from "vitest";
import { normalizeRepoUrl, extractRepoDirectory } from "../normalizeRepoUrl.js";

describe("normalizeRepoUrl", () => {
  it("normalizes a GitHub HTTPS URL string", () => {
    expect(normalizeRepoUrl("https://github.com/facebook/react")).toBe(
      "https://github.com/facebook/react"
    );
  });

  it("strips git+ prefix", () => {
    expect(normalizeRepoUrl("git+https://github.com/facebook/react")).toBe(
      "https://github.com/facebook/react"
    );
  });

  it("strips .git suffix", () => {
    expect(normalizeRepoUrl("https://github.com/facebook/react.git")).toBe(
      "https://github.com/facebook/react"
    );
  });

  it("converts ssh://git@github.com to HTTPS", () => {
    expect(normalizeRepoUrl("ssh://git@github.com/facebook/react")).toBe(
      "https://github.com/facebook/react"
    );
  });

  it("normalizes git@github.com: SSH shorthand", () => {
    expect(normalizeRepoUrl("git@github.com:facebook/react")).toBe(
      "https://github.com/facebook/react"
    );
  });

  it("extracts URL from object with url property", () => {
    expect(normalizeRepoUrl({ url: "https://github.com/facebook/react.git" })).toBe(
      "https://github.com/facebook/react"
    );
  });

  it("returns null for non-GitHub URL", () => {
    expect(normalizeRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(normalizeRepoUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeRepoUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeRepoUrl("")).toBeNull();
  });

  it("returns null for object without url property", () => {
    expect(normalizeRepoUrl({ type: "git" })).toBeNull();
  });
});
```

- [ ] **Step 2: Write all extractRepoDirectory tests**

Append to same file:

```typescript
describe("extractRepoDirectory", () => {
  it("returns directory from object", () => {
    expect(extractRepoDirectory({ directory: "packages/core" })).toBe("packages/core");
  });

  it("returns null when object has no directory", () => {
    expect(extractRepoDirectory({ url: "https://github.com/o/r" })).toBeNull();
  });

  it("returns null for empty string directory", () => {
    expect(extractRepoDirectory({ directory: "" })).toBeNull();
  });

  it("returns null for string input", () => {
    expect(extractRepoDirectory("https://github.com/o/r")).toBeNull();
  });

  it("returns null for null", () => {
    expect(extractRepoDirectory(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(extractRepoDirectory(undefined)).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `yarn test src/api/services/packageManagers/__tests__/normalizeRepoUrl.test.ts`
Expected: All 17 tests pass.

- [ ] **Step 4: Format and lint**

Run: `yarn format:fix && yarn lint`

- [ ] **Step 5: Commit**

```bash
git add src/api/services/packageManagers/__tests__/normalizeRepoUrl.test.ts
git commit -m "test: add unit tests for normalizeRepoUrl and extractRepoDirectory"
```

---

### Task 2: ChangelogFileResolver repoDirectory path tests

**Files:**

- Modify: `src/api/services/changelogResolvers/__tests__/ChangelogFileResolver.test.ts`
- Reference: `src/api/services/changelogResolvers/ChangelogFileResolver.ts`

**Interfaces:**

- Consumes: `ChangelogFileResolver.resolve(packageName, repoUrl, versions, repoDirectory?)` — 4th arg is new `repoDirectory`
- Produces: Nothing — pure test file

- [ ] **Step 1: Write test — repoDirectory path tried first**

Add to existing `describe("ChangelogFileResolver")` block:

```typescript
it("tries repoDirectory paths before root when repoDirectory is provided", async () => {
  const changelogContent = "## 1.0.0\n- monorepo entry";
  const requestedPaths: string[] = [];

  const resolver = new ChangelogFileResolver(
    createCommandRunner(async (_command, args) => {
      if (args.includes("--version")) {
        return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
      }
      const contentArg = args.find(a => a.includes("contents/"));
      if (contentArg) {
        requestedPaths.push(contentArg);
      }
      if (args.some(arg => arg.includes("packages/core/CHANGELOG.md"))) {
        return {
          stdout: JSON.stringify({
            content: toBase64(changelogContent),
            encoding: "base64"
          }),
          stderr: "",
          exitCode: 0
        };
      }
      return { stdout: "", stderr: "not found", exitCode: 1 };
    })
  );

  const result = await resolver.resolve(
    "some-package",
    "https://github.com/owner/repo",
    ["1.0.0"],
    "packages/core"
  );

  expect(result.size).toBe(1);
  expect(result.get("1.0.0")).toBe("- monorepo entry");
  expect(requestedPaths[0]).toContain("packages/core/CHANGELOG.md");
});
```

- [ ] **Step 2: Write test — repoDirectory not found, falls back to root**

```typescript
it("falls back to root CHANGELOG.md when repoDirectory changelog not found", async () => {
  const rootChangelog = "## 1.0.0\n- root entry";

  const resolver = new ChangelogFileResolver(
    createCommandRunner(async (_command, args) => {
      if (args.includes("--version")) {
        return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
      }
      if (args.some(arg => arg.includes("packages/core/"))) {
        return { stdout: "", stderr: "not found", exitCode: 1 };
      }
      if (args.some(arg => arg.includes("contents/CHANGELOG.md"))) {
        return {
          stdout: JSON.stringify({
            content: toBase64(rootChangelog),
            encoding: "base64"
          }),
          stderr: "",
          exitCode: 0
        };
      }
      return { stdout: "", stderr: "not found", exitCode: 1 };
    })
  );

  const result = await resolver.resolve(
    "some-package",
    "https://github.com/owner/repo",
    ["1.0.0"],
    "packages/core"
  );

  expect(result.size).toBe(1);
  expect(result.get("1.0.0")).toBe("- root entry");
});
```

- [ ] **Step 3: Write test — repoDirectory with scoped package**

```typescript
it("tries repoDirectory before packages/<unscoped> for scoped packages", async () => {
  const changelogContent = "## 2.0.0\n- scoped monorepo entry";
  const requestedPaths: string[] = [];

  const resolver = new ChangelogFileResolver(
    createCommandRunner(async (_command, args) => {
      if (args.includes("--version")) {
        return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
      }
      const contentArg = args.find(a => a.includes("contents/"));
      if (contentArg) {
        requestedPaths.push(contentArg);
      }
      if (args.some(arg => arg.includes("libs/anthropic/CHANGELOG.md"))) {
        return {
          stdout: JSON.stringify({
            content: toBase64(changelogContent),
            encoding: "base64"
          }),
          stderr: "",
          exitCode: 0
        };
      }
      return { stdout: "", stderr: "not found", exitCode: 1 };
    })
  );

  const result = await resolver.resolve(
    "@ai-sdk/anthropic",
    "https://github.com/vercel/ai",
    ["2.0.0"],
    "libs/anthropic"
  );

  expect(result.size).toBe(1);
  expect(result.get("2.0.0")).toBe("- scoped monorepo entry");
  expect(requestedPaths[0]).toContain("libs/anthropic/CHANGELOG.md");
});
```

- [ ] **Step 4: Run tests**

Run: `yarn test src/api/services/changelogResolvers/__tests__/ChangelogFileResolver.test.ts`
Expected: All 10 tests pass (7 existing + 3 new).

- [ ] **Step 5: Format, lint, commit**

```bash
yarn format:fix && yarn lint
git add src/api/services/changelogResolvers/__tests__/ChangelogFileResolver.test.ts
git commit -m "test: add ChangelogFileResolver repoDirectory path tests"
```
