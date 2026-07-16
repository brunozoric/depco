# OSV Markdown Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render OSV vulnerability descriptions as formatted markdown instead of plain text on the detail page.

**Architecture:** Frontend-only change. Swap `<Text>` for `<ReactMarkdown>` with `rehype-sanitize` inside the existing description card. `react-markdown` is already installed.

**Tech Stack:** react-markdown (existing), rehype-sanitize (new), Mantine Typography + Anchor

## Global Constraints

- Use `yarn` for dependency management
- Use full words in identifiers (e.g., "Vulnerability" not "Vuln")
- No backend or presenter changes
- Project tests presenters, not React components — no component tests to write

---

### Task 1: Add rehype-sanitize and render description as markdown

**Files:**

- Modify: `package.json` (add rehype-sanitize)
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityDetail/components/VulnerabilityDetailPage.tsx:229-236`

**Interfaces:**

- Consumes: `vm.description: string | null` (unchanged from presenter)
- Produces: No new interfaces — rendering-only change

- [ ] **Step 1: Install rehype-sanitize**

Run:

```bash
yarn add rehype-sanitize
```

- [ ] **Step 2: Add imports to VulnerabilityDetailPage.tsx**

Add `Typography` to the existing `@mantine/core` destructured import (line 4-17):

```tsx
import {
  Stack,
  Title,
  Group,
  Badge,
  Text,
  Button,
  Menu,
  Anchor,
  Card,
  Table,
  Skeleton,
  SimpleGrid,
  Typography
} from "@mantine/core";
```

Add two new imports after the Mantine import block:

```tsx
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
```

- [ ] **Step 3: Replace plain text rendering with ReactMarkdown**

Replace lines 229-236:

```tsx
// Before:
{
  vm.description && (
    <Card shadow="sm" padding="md" withBorder>
      <Text fw={600} mb="xs">
        Description
      </Text>
      <Text style={{ whiteSpace: "pre-wrap" }}>{vm.description}</Text>
    </Card>
  );
}

// After:
{
  vm.description && (
    <Card shadow="sm" padding="md" withBorder>
      <Text fw={600} mb="xs">
        Description
      </Text>
      <Typography>
        <ReactMarkdown
          rehypePlugins={[rehypeSanitize]}
          components={{
            a: ({ children, href }) => (
              <Anchor href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </Anchor>
            )
          }}
        >
          {vm.description}
        </ReactMarkdown>
      </Typography>
    </Card>
  );
}
```

- [ ] **Step 4: Run lint and type check**

Run:

```bash
yarn lint && yarn tsc --noEmit
```

Expected: No errors. If `Typography` import fails type check, verify the component name from `@mantine/core` exports.

- [ ] **Step 5: Run full test suite**

Run:

```bash
yarn test
```

Expected: All 1349 tests pass. No presenter or backend tests affected by this change.

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock src/ui/presentation/vulnerabilities/VulnerabilityDetail/components/VulnerabilityDetailPage.tsx
git commit -m "feat(vulnerabilities): render OSV description as markdown

Use react-markdown with rehype-sanitize on the vulnerability detail page.
Links open in new tab with noopener/noreferrer. Raw HTML stripped via
GitHub sanitization schema. Mantine Typography wrapper for consistent styling."
```
