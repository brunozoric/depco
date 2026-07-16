# Spinner Progress Percentage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show resolve progress percentage in changelog spinner (e.g. "Fetching changelogs... 42%") in both ChangelogModal and ChangelogDrawer.

**Architecture:** Pure client-side counting. Count `content === null` entries on fetch as total. Increment on each `changelog:resolved` WS event. No API or WS changes.

**Tech Stack:** React useState, existing WS listener pattern

## Global Constraints

- Formatter: oxfmt (`yarn format:fix`)
- Linter: oxlint (`yarn lint`)
- No API changes
- No WS event changes
- Both ChangelogModal and ChangelogDrawer must be updated identically

---

### Task 1: ChangelogModal progress percentage

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`

**Interfaces:**

- Consumes: `result.entries` (array with `content: string | null`), `changelog:resolved` WS event, `job:status` WS event
- Produces: Visual change only — percentage text in spinner

- [ ] **Step 1: Add state variables**

After line 42 (`const [resolving, setResolving] = useState(false);`), add:

```typescript
const [resolvedCount, setResolvedCount] = useState(0);
const [totalToResolve, setTotalToResolve] = useState(0);
```

- [ ] **Step 2: Set totalToResolve on initial fetch**

In the `useEffect` that fetches changelogs (lines 60-75), after `setResolving(result.resolving)`, add counting logic. Replace the `.then` block:

```typescript
.then(result => {
    setEntries(result.entries.reverse());
    setResolving(result.resolving);
    setResolvedCount(0);
    setTotalToResolve(result.entries.filter(e => e.content === null).length);
    setLoading(false);
})
```

- [ ] **Step 3: Set totalToResolve on refresh**

In `handleRefresh()`, replace the `.then` block:

```typescript
.then(result => {
    setEntries(result.entries.reverse());
    setResolving(result.resolving);
    setResolvedCount(0);
    setTotalToResolve(result.entries.filter(e => e.content === null).length);
    setRefreshing(false);
})
```

- [ ] **Step 4: Increment resolvedCount on WS event**

In the `changelog:resolved` WS handler (lines 82-102), add after the `setEntries` call. The handler already checks `data.packageName !== packageName`. Add increment inside the handler, before `setEntries`:

```typescript
const handler: WebSocketListener.Callback<"changelog:resolved"> = (
  data: WSChangelogResolved
): void => {
  if (data.packageName !== packageName) {
    return;
  }
  setResolvedCount(prev => prev + 1);
  setEntries(prev => {
    const existing = prev.find(e => e.version === data.version);
    if (existing) {
      return prev.map(e =>
        e.version === data.version ? { ...e, content: data.content, source: data.source } : e
      );
    }
    return [...prev, { version: data.version, content: data.content, source: data.source }].sort(
      (a, b) => compareVersions(b.version, a.version)
    );
  });
};
```

- [ ] **Step 5: Update spinner display**

Replace lines 180-187:

```tsx
{
  resolving && (
    <Group gap="xs" justify="center" py="sm">
      <Loader size="xs" />
      <Text size="xs" c="dimmed">
        Fetching changelogs...
        {totalToResolve > 0 && ` ${Math.round((resolvedCount / totalToResolve) * 100)}%`}
      </Text>
    </Group>
  );
}
```

- [ ] **Step 6: Format, lint, verify build**

Run: `yarn format:fix && yarn lint && yarn build:ui`

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx
git commit -m "feat: add progress percentage to ChangelogModal spinner"
```

---

### Task 2: ChangelogDrawer progress percentage

**Files:**

- Modify: `src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx`

**Interfaces:**

- Consumes: Same as Task 1 — `result.entries`, `changelog:resolved`, `job:status`
- Produces: Visual change only

- [ ] **Step 1: Add state variables**

After line 42 (`const [resolving, setResolving] = useState(false);`), add:

```typescript
const [resolvedCount, setResolvedCount] = useState(0);
const [totalToResolve, setTotalToResolve] = useState(0);
```

- [ ] **Step 2: Set totalToResolve on initial fetch**

Replace the `.then` block in the fetch `useEffect` (lines 65-71):

```typescript
.then(result => {
    setEntries(result.entries.reverse());
    setResolving(result.resolving);
    setResolvedCount(0);
    setTotalToResolve(result.entries.filter(e => e.content === null).length);
    setLoading(false);
})
```

- [ ] **Step 3: Set totalToResolve on refresh**

Replace the `.then` block in `handleRefresh()`:

```typescript
.then(result => {
    setEntries(result.entries.reverse());
    setResolving(result.resolving);
    setResolvedCount(0);
    setTotalToResolve(result.entries.filter(e => e.content === null).length);
    setRefreshing(false);
})
```

- [ ] **Step 4: Increment resolvedCount on WS event**

Replace the `changelog:resolved` handler with the same pattern as ChangelogModal:

```typescript
const handler: WebSocketListener.Callback<"changelog:resolved"> = (
  data: WSChangelogResolved
): void => {
  if (data.packageName !== packageName) {
    return;
  }
  setResolvedCount(prev => prev + 1);
  setEntries(prev => {
    const existing = prev.find(e => e.version === data.version);
    if (existing) {
      return prev.map(e =>
        e.version === data.version ? { ...e, content: data.content, source: data.source } : e
      );
    }
    return [...prev, { version: data.version, content: data.content, source: data.source }].sort(
      (a, b) => compareVersions(b.version, a.version)
    );
  });
};
```

- [ ] **Step 5: Update spinner display**

Replace lines 190-197:

```tsx
{
  resolving && (
    <Group gap="xs" justify="center" py="sm">
      <Loader size="xs" />
      <Text size="xs" c="dimmed">
        Fetching changelogs...
        {totalToResolve > 0 && ` ${Math.round((resolvedCount / totalToResolve) * 100)}%`}
      </Text>
    </Group>
  );
}
```

- [ ] **Step 6: Format, lint, verify build**

Run: `yarn format:fix && yarn lint && yarn build:ui`

- [ ] **Step 7: Run full check**

Run: `yarn full`

- [ ] **Step 8: Commit**

```bash
git add src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx
git commit -m "feat: add progress percentage to ChangelogDrawer spinner"
```
