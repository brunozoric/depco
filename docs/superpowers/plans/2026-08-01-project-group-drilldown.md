# Project-Level Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Group by project" toggle to the vulnerabilities list page that organizes vulnerabilities into collapsible per-project sections with severity counts. Auto-enabled on trend chart drill-down.

**Architecture:** Presenter-driven grouping. The presenter computes project groups from the existing sorted vulnerability list. The page renders Mantine `Accordion` sections when grouping is active. No backend changes.

**Tech Stack:** TypeScript, MobX, Mantine (Accordion, Switch), Vitest

## Global Constraints

- Use `yarn` for dependency management
- Use full words in identifiers
- No backend changes, no schema changes
- Severities include: critical, high, moderate, low, info
- `Switch` already imported in VulnerabilitiesPage.tsx; `Accordion` needs adding

---

### Task 1: Add groupByProject to presenter abstraction, implementation, and tests

**Files:**

- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts`
- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`
- Test: `src/ui/presentation/vulnerabilities/VulnerabilityList/__tests__/VulnerabilitiesPresenter.test.ts`

**Interfaces:**

- Consumes: `VulnerabilitiesGateway.VulnerabilityItem` (existing, has projectId, projectName, severity)
- Produces: `IVulnerabilityProjectGroup` type, `groupByProject` state, `setGroupByProject` method, `groupedVulnerabilities` computed

- [ ] **Step 1: Write failing test — groupByProject defaults to false**

Add a new `describe("groupByProject")` block inside the existing `describe("VulnerabilitiesPresenter")`. Add test:

```typescript
describe("groupByProject", () => {
  it("defaults to false with empty grouped vulnerabilities", () => {
    const presenter = createPresenter();
    expect(presenter.vm.groupByProject).toBe(false);
    expect(presenter.vm.groupedVulnerabilities).toEqual([]);
  });
});
```

- [ ] **Step 2: Write failing test — setGroupByProject toggles state**

```typescript
it("setGroupByProject toggles grouping and reflects in vm", () => {
  const presenter = createPresenter();
  presenter.setGroupByProject(true);
  expect(presenter.vm.groupByProject).toBe(true);
  presenter.setGroupByProject(false);
  expect(presenter.vm.groupByProject).toBe(false);
});
```

- [ ] **Step 3: Write failing test — groups vulnerabilities by project**

```typescript
it("groups vulnerabilities by project with severity counts when enabled", async () => {
  const presenter = createPresenter();
  setResponse(listVulnerabilitiesRoute, {
    items: [
      { id: "v1", projectId: "p1", projectName: "Alpha", severity: "critical", packageName: "a" },
      { id: "v2", projectId: "p1", projectName: "Alpha", severity: "high", packageName: "b" },
      { id: "v3", projectId: "p2", projectName: "Beta", severity: "low", packageName: "c" }
    ],
    total: 3
  });
  await presenter.load();
  presenter.setGroupByProject(true);

  const groups = presenter.vm.groupedVulnerabilities;
  expect(groups).toHaveLength(2);
  expect(groups[0]!.projectName).toBe("Alpha");
  expect(groups[0]!.vulnerabilities).toHaveLength(2);
  expect(groups[0]!.counts.critical).toBe(1);
  expect(groups[0]!.counts.high).toBe(1);
  expect(groups[1]!.projectName).toBe("Beta");
  expect(groups[1]!.vulnerabilities).toHaveLength(1);
  expect(groups[1]!.counts.low).toBe(1);
});
```

- [ ] **Step 4: Write failing test — groups sorted by count descending**

```typescript
it("sorts groups by vulnerability count descending", async () => {
  const presenter = createPresenter();
  setResponse(listVulnerabilitiesRoute, {
    items: [
      { id: "v1", projectId: "p1", projectName: "Few", severity: "high", packageName: "a" },
      { id: "v2", projectId: "p2", projectName: "Many", severity: "critical", packageName: "b" },
      { id: "v3", projectId: "p2", projectName: "Many", severity: "high", packageName: "c" },
      { id: "v4", projectId: "p2", projectName: "Many", severity: "low", packageName: "d" }
    ],
    total: 4
  });
  await presenter.load();
  presenter.setGroupByProject(true);

  const groups = presenter.vm.groupedVulnerabilities;
  expect(groups[0]!.projectName).toBe("Many");
  expect(groups[0]!.vulnerabilities).toHaveLength(3);
  expect(groups[1]!.projectName).toBe("Few");
  expect(groups[1]!.vulnerabilities).toHaveLength(1);
});
```

- [ ] **Step 5: Write failing test — auto-enables on scannedDate**

```typescript
it("auto-enables groupByProject when scannedDate URL param is present", async () => {
  vi.stubGlobal("window", {
    location: { search: "?scannedDate=2024-01-15", pathname: "/vulnerabilities" }
  });

  const presenter = createPresenter();
  await presenter.load();
  expect(presenter.vm.groupByProject).toBe(true);

  vi.unstubAllGlobals();
});
```

- [ ] **Step 6: Write failing test — returns empty groups when disabled**

```typescript
it("returns empty groupedVulnerabilities when groupByProject is false", async () => {
  const presenter = createPresenter();
  setResponse(listVulnerabilitiesRoute, {
    items: [
      { id: "v1", projectId: "p1", projectName: "Alpha", severity: "high", packageName: "a" }
    ],
    total: 1
  });
  await presenter.load();

  expect(presenter.vm.groupByProject).toBe(false);
  expect(presenter.vm.groupedVulnerabilities).toEqual([]);
});
```

- [ ] **Step 7: Run tests to verify they all fail**

Run:

```bash
yarn test src/ui/presentation/vulnerabilities/VulnerabilityList/__tests__/VulnerabilitiesPresenter.test.ts
```

Expected: 6 new tests FAIL. Existing tests pass.

- [ ] **Step 8: Add types to abstraction**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts`:

Add new interface after `IVulnProjectOption` (line 25):

```typescript
export interface IVulnerabilityProjectGroup {
  projectId: string;
  projectName: string;
  counts: { critical: number; high: number; moderate: number; low: number; info: number };
  vulnerabilities: IVulnerabilityRowViewModel[];
}
```

Add to `IVulnerabilitiesViewModel` (after `scannedDate` at line 47):

```typescript
    groupByProject: boolean;
    groupedVulnerabilities: IVulnerabilityProjectGroup[];
```

Add to `IVulnerabilitiesPresenter` (after `clearScannedDate` at line 69):

```typescript
    setGroupByProject(value: boolean): void;
```

Add to namespace (after `ProjectOption` at line 80):

```typescript
export type ProjectGroup = IVulnerabilityProjectGroup;
```

- [ ] **Step 9: Implement in presenter**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts`:

Add private state (after `scannedDate` at line 34):

```typescript
    private groupByProject = false;
```

In `load()`, after `this.scannedDate = urlParams.get("scannedDate");` (line 95), add:

```typescript
if (this.scannedDate) {
  this.groupByProject = true;
}
```

Add to `vm` getter return object (after `scannedDate` at line 84):

```typescript
            groupByProject: this.groupByProject,
            groupedVulnerabilities: this.groupByProject
                ? this.computeProjectGroups(vulnerabilities)
                : [],
```

Add public method (after `clearScannedDate` method, around line 270):

```typescript
    public setGroupByProject = (value: boolean): void => {
        this.groupByProject = value;
    };
```

Add private method (after `debouncedLoad` method, around line 360):

```typescript
    private computeProjectGroups(
        items: Abstraction.VulnerabilityRow[]
    ): Abstraction.ProjectGroup[] {
        const groupMap = new Map<string, {
            projectId: string;
            projectName: string;
            counts: { critical: number; high: number; moderate: number; low: number; info: number };
            vulnerabilities: Abstraction.VulnerabilityRow[];
        }>();

        for (const item of items) {
            let group = groupMap.get(item.projectId);
            if (!group) {
                group = {
                    projectId: item.projectId,
                    projectName: item.projectName,
                    counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
                    vulnerabilities: []
                };
                groupMap.set(item.projectId, group);
            }
            const severity = item.severity as keyof typeof group.counts;
            if (severity in group.counts) {
                group.counts[severity]++;
            }
            group.vulnerabilities.push(item);
        }

        return Array.from(groupMap.values()).sort(
            (a, b) => b.vulnerabilities.length - a.vulnerabilities.length
        );
    }
```

- [ ] **Step 10: Run tests to verify they pass**

Run:

```bash
yarn test src/ui/presentation/vulnerabilities/VulnerabilityList/__tests__/VulnerabilitiesPresenter.test.ts
```

Expected: All tests pass (existing + 6 new).

- [ ] **Step 11: Run lint and type check**

Run:

```bash
yarn lint && yarn tsc --noEmit
```

Expected: No errors.

- [ ] **Step 12: Commit**

```bash
git add src/ui/presentation/vulnerabilities/VulnerabilityList/abstractions/VulnerabilitiesPresenter.ts src/ui/presentation/vulnerabilities/VulnerabilityList/VulnerabilitiesPresenter.ts src/ui/presentation/vulnerabilities/VulnerabilityList/__tests__/VulnerabilitiesPresenter.test.ts
git commit -m "feat(vulnerabilities): add groupByProject presenter logic with auto-enable on drill-down

Add IVulnerabilityProjectGroup type, computeProjectGroups method,
setGroupByProject toggle, and auto-enable when scannedDate param
is present. Groups sorted by count descending."
```

---

### Task 2: Add Accordion UI for grouped vulnerabilities

**Files:**

- Modify: `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`

**Interfaces:**

- Consumes: `vm.groupByProject: boolean`, `vm.groupedVulnerabilities: ProjectGroup[]`, `presenter.setGroupByProject(value: boolean)`
- Produces: No new interfaces — rendering-only change

- [ ] **Step 1: Add Accordion import**

In `src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx`, add `Accordion` to the existing Mantine import block (line 4-22):

```tsx
import {
  Stack,
  Title,
  Group,
  Table,
  Badge,
  Text,
  Select,
  MultiSelect,
  Switch,
  Menu,
  Checkbox,
  Button,
  TextInput,
  Pagination,
  Skeleton,
  Anchor,
  UnstyledButton,
  Accordion
} from "@mantine/core";
```

- [ ] **Step 2: Add Group by project toggle**

In the filter bar area, after the "Show dismissed" Switch (find the existing `<Switch label="Show dismissed"` around line 159), add:

```tsx
<Switch
  label="Group by project"
  checked={vm.groupByProject}
  onChange={event => presenter.setGroupByProject(event.currentTarget.checked)}
/>
```

- [ ] **Step 3: Extract table row rendering**

The table rows (lines 286-345) render each vulnerability. To reuse in both flat table and accordion panels, extract the row rendering into a local function inside the component:

```tsx
function renderVulnerabilityRow(vuln: VulnerabilitiesPresenter.VulnerabilityRow): React.ReactNode {
  return (
    <Table.Tr key={vuln.id} opacity={vuln.isDismissed ? 0.5 : 1}>
      <Table.Td>
        <Checkbox
          checked={vm.selectedIds.includes(vuln.id)}
          onChange={() => presenter.toggleSelected(vuln.id)}
        />
      </Table.Td>
      <Table.Td>
        <Badge color={SEVERITY_COLORS[vuln.severity]}>{vuln.severity}</Badge>
      </Table.Td>
      <Table.Td>{vuln.packageName}</Table.Td>
      <Table.Td>
        <Anchor
          component="button"
          size="sm"
          onClick={() => navigate(`/projects/${vuln.projectId}`)}
        >
          {vuln.projectName}
        </Anchor>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Anchor
            component="button"
            size="sm"
            onClick={() => navigate(`/vulnerabilities/${vuln.id}`)}
            style={{ maxWidth: 300 }}
            truncate
          >
            {vuln.title}
          </Anchor>
          {vuln.dismissLabel && (
            <Badge size="xs" color="gray">
              {vuln.dismissLabel}
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        {vuln.cveId && vuln.advisoryUrl && isSafeAdvisoryUrl(vuln.advisoryUrl) ? (
          <Anchor href={vuln.advisoryUrl} target="_blank" size="sm">
            {vuln.cveId}
          </Anchor>
        ) : (
          (vuln.cveId ?? "—")
        )}
      </Table.Td>
      <Table.Td>{vuln.fixVersion ?? "—"}</Table.Td>
      <Table.Td>
        <Badge color={SOURCE_COLORS[vuln.source] ?? "gray"} variant="light">
          {vuln.source}
        </Badge>
      </Table.Td>
    </Table.Tr>
  );
}
```

Place this function inside the `VulnerabilitiesPage` component (the observer function starting at line 70), before the return statement. Then replace the existing `{vm.vulnerabilities.map(vuln => (...))}` in the flat table tbody with `{vm.vulnerabilities.map(renderVulnerabilityRow)}`.

- [ ] **Step 4: Add grouped Accordion rendering**

Wrap the table + pagination in a conditional: when `vm.groupByProject` is true, render the Accordion; otherwise render the existing flat table. Place this where the `<Table>` currently lives:

```tsx
{
  vm.groupByProject ? (
    <Accordion multiple defaultValue={vm.groupedVulnerabilities.map(g => g.projectId)}>
      {vm.groupedVulnerabilities.map(group => (
        <Accordion.Item key={group.projectId} value={group.projectId}>
          <Accordion.Control>
            <Group gap="sm">
              <Text fw={600}>{group.projectName}</Text>
              <Text size="sm" c="dimmed">
                ({group.vulnerabilities.length})
              </Text>
              {group.counts.critical > 0 && (
                <Badge color="red" size="sm">
                  {group.counts.critical} critical
                </Badge>
              )}
              {group.counts.high > 0 && (
                <Badge color="orange" size="sm">
                  {group.counts.high} high
                </Badge>
              )}
              {group.counts.moderate > 0 && (
                <Badge color="yellow" size="sm">
                  {group.counts.moderate} moderate
                </Badge>
              )}
              {group.counts.low > 0 && (
                <Badge color="blue" size="sm">
                  {group.counts.low} low
                </Badge>
              )}
              {group.counts.info > 0 && (
                <Badge color="gray" size="sm">
                  {group.counts.info} info
                </Badge>
              )}
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}></Table.Th>
                  <Table.Th>Severity</Table.Th>
                  <Table.Th>Package</Table.Th>
                  <Table.Th>Project</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>CVE</Table.Th>
                  <Table.Th>Fix</Table.Th>
                  <Table.Th>Source</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{group.vulnerabilities.map(renderVulnerabilityRow)}</Table.Tbody>
            </Table>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  ) : (
    // Existing flat table (unchanged)
    <Table striped highlightOnHover>
      ...existing table code...
    </Table>
  );
}
```

The existing flat table code stays in the `else` branch unchanged, but uses `{vm.vulnerabilities.map(renderVulnerabilityRow)}` for the tbody.

**Pagination:** The existing `{vm.totalPages > 1 && <Pagination ... />}` block stays outside and below the conditional — it renders in both flat and grouped modes. Groups are computed from the current page slice, so pagination controls which items are visible regardless of view mode.

- [ ] **Step 5: Run lint and type check**

Run:

```bash
yarn lint && yarn tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Run full test suite**

Run:

```bash
yarn test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/vulnerabilities/VulnerabilityList/components/VulnerabilitiesPage.tsx
git commit -m "feat(vulnerabilities): add collapsible project group UI with Accordion

Render grouped vulnerabilities in Mantine Accordion when groupByProject
is enabled. Each section shows project name with severity count badges.
Toggle switch in filter bar. Reuses extracted row rendering function."
```
