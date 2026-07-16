# UI Streaming Changelogs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ChangelogModal and ChangelogDrawer show cached entries immediately, subscribe to `changelog:resolved` WS events, and display entries live as they arrive. Job Manager shows changelog jobs with package name.

**Architecture:** Modal/Drawer components subscribe to WS on mount, filter events by packageName, update local state per event. Re-fetch button triggers POST re-resolve and resubscribes. Job Manager branches on `referenceType` for display name.

**Tech Stack:** React, MobX, Mantine, WebSocket

## Global Constraints

- Depends on plans 01 (referenceId rename) and 02 (executor + async API) being complete
- WS subscription uses existing `WebSocketListener` pattern from container
- No new DI abstractions — modal/drawer components access WS directly via container

---

### Task 1: ChangelogModal Live Updates

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/components/ChangelogModal.tsx`

**Consumes:** `getChangelogs()` returns `{ entries, resolving }`, `changelog:resolved` WS event

- [ ] **Step 1: Update ChangelogModal to handle resolving state**

The `getChangelogs` callback now returns `{ entries, resolving }`. Update the `useEffect`:

```typescript
useEffect(() => {
  if (opened) {
    setLoading(true);
    getChangelogs(packageName, currentVersion, latestVersion)
      .then(result => {
        setEntries(result.entries.reverse());
        setResolving(result.resolving);
        setLoading(false);
      })
      .catch(() => {
        setEntries([]);
        setResolving(false);
        setLoading(false);
      });
  }
}, [opened, packageName, currentVersion, latestVersion, getChangelogs]);
```

Add `resolving` state:

```typescript
const [resolving, setResolving] = useState(false);
```

- [ ] **Step 2: Subscribe to changelog:resolved WS events**

The component needs access to `WebSocketListener`. Pass it as a prop or access via `useContainer()`. Since ChangelogModal is a plain component (not observer-wrapped at the feature level), pass the listener as prop from the parent.

Add to props:

```typescript
interface ChangelogModalProps {
  // ... existing props
  webSocketListener?: WebSocketListener.Interface;
}
```

Add WS subscription effect:

```typescript
useEffect(() => {
  if (!opened || !webSocketListener || !resolving) {
    return;
  }

  const handler = (data: WSChangelogResolved): void => {
    if (data.packageName !== packageName) {
      return;
    }
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

  webSocketListener.on("changelog:resolved", handler);
  return () => {
    webSocketListener.off("changelog:resolved", handler);
  };
}, [opened, webSocketListener, resolving, packageName]);
```

Import `WSChangelogResolved` from shared types.

- [ ] **Step 3: Show resolving indicator**

When `resolving` is true, show a small loader/text below the accordion:

```typescript
{resolving && (
    <Group gap="xs" justify="center" py="sm">
        <Loader size="xs" />
        <Text size="xs" c="dimmed">Fetching changelogs...</Text>
    </Group>
)}
```

- [ ] **Step 4: Update re-fetch handler**

The `onRefresh` callback now returns `{ entries, resolving }`:

```typescript
function handleRefresh(): void {
  if (!onRefresh) {
    return;
  }
  setRefreshing(true);
  onRefresh(packageName, currentVersion, latestVersion)
    .then(result => {
      setEntries(result.entries.reverse());
      setResolving(result.resolving);
      setRefreshing(false);
    })
    .catch(() => {
      setRefreshing(false);
    });
}
```

- [ ] **Step 5: Build check**

```bash
yarn build 2>&1 | tail -10
```

---

### Task 2: ChangelogDrawer Live Updates

**Files:**

- Modify: `src/ui/presentation/projects/UpgradeWizard/components/ChangelogDrawer.tsx`

Same changes as Task 1 but for the Drawer component. Key differences:

- Uses `target` prop instead of individual `packageName`/`currentVersion`/`latestVersion` props
- Uses Drawer instead of Modal

- [ ] **Step 1: Apply same pattern as ChangelogModal**

Add `resolving` state, WS subscription, resolving indicator, update `getChangelogs` and `onRefresh` handlers to handle `{ entries, resolving }` return type.

- [ ] **Step 2: Build check**

```bash
yarn build 2>&1 | tail -10
```

---

### Task 3: Wire WebSocketListener to Modal/Drawer Parents

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`
- Modify: `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx`
- Modify: `src/ui/presentation/projects/UpgradeWizard/components/SelectPackagesStep.tsx`

- [ ] **Step 1: Pass webSocketListener to ChangelogModal in ProjectDetailPage**

Access via `useContainer()`:

```typescript
const container = useContainer();
const webSocketListener = container.resolve(WebSocketListener);
```

Pass to `<ChangelogModal webSocketListener={webSocketListener} ... />`.

Import `useContainer` from `#ui/shared/di/ContainerProvider.js` and `WebSocketListener` from websocket feature.

- [ ] **Step 2: Same for PackagesPage**

Pass `webSocketListener` to `<ChangelogModal>`.

- [ ] **Step 3: Same for SelectPackagesStep**

Pass `webSocketListener` to `<ChangelogDrawer>`.

- [ ] **Step 4: Build + test**

```bash
yarn build 2>&1 | tail -5
yarn test 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/
git commit -m "feat: live changelog streaming via WS in modal and drawer"
```

---

### Task 4: Job Manager Changelog Support

**Files:**

- Modify: `src/ui/presentation/jobs/JobManager/components/JobManagerPage.tsx`
- Modify: `src/ui/presentation/jobs/JobManager/JobManagerPresenter.ts`
- Modify: `src/ui/presentation/jobs/JobManager/abstractions/JobManagerPresenter.ts`

- [ ] **Step 1: Update JobManager VM to expose referenceType**

In the presenter abstraction, ensure the job view model includes `referenceType`:

```typescript
export interface IJobViewModel {
  // ... existing fields
  referenceId: string;
  referenceType: string;
  // ...
}
```

- [ ] **Step 2: Update JobManagerPage display**

Where project name is shown, branch on `referenceType`:

```typescript
{
  job.referenceType === "project" ? (projectName ?? job.referenceId) : job.referenceId;
}
```

For the project name lookup, only attempt it when `referenceType === "project"`.

Guard navigation: clicking a job's reference name should only navigate to `/projects/:id` when `referenceType === "project"`. For `"package"` jobs, either don't navigate or navigate to `/packages` with a search filter.

- [ ] **Step 3: Add "changelog" to job type filter**

In the type filter options, add `{ label: "Changelog", value: "changelog" }`.

- [ ] **Step 4: Build + test**

```bash
yarn build 2>&1 | tail -5
yarn test 2>&1 | tail -10
```

- [ ] **Step 5: Full pipeline**

```bash
yarn full
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/presentation/jobs/
git commit -m "feat: Job Manager shows changelog jobs with package name"
```
