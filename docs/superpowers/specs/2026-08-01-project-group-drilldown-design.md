# Feature 6: Project-Level Grouping on Vulnerability List

## Problem

The vulnerability list page shows a flat table. When drilling down from the dashboard trend chart (via `scannedDate` query param), there is no per-project breakdown — all vulnerabilities from all projects are interleaved.

## Solution

Add a "Group by project" toggle to the vulnerabilities list page. When enabled, vulnerabilities are grouped into collapsible project sections, each showing a severity count header. Auto-enable when arriving from trend chart drill-down (`scannedDate` param present).

## Approach

**Approach A (chosen): Presenter-driven grouping with UI toggle**

Grouping logic lives in the presenter. Vulnerabilities already carry `projectId` and `projectName`. The presenter computes groups from the existing sorted list. The page renders collapsible `Accordion` sections when grouping is active.

Rejected alternative:

- Backend grouped endpoint: over-engineered. Client already has all data needed for grouping.

## Changes

### 1. Abstraction — `abstractions/VulnerabilitiesPresenter.ts`

Add to `IVulnerabilitiesViewModel`:

```typescript
groupByProject: boolean;
groupedVulnerabilities: IVulnerabilityProjectGroup[];
```

Add new interface:

```typescript
export interface IVulnerabilityProjectGroup {
  projectId: string;
  projectName: string;
  counts: { critical: number; high: number; moderate: number; low: number; info: number };
  vulnerabilities: IVulnerabilityRowViewModel[];
}
```

Add to `IVulnerabilitiesPresenter`:

```typescript
setGroupByProject(value: boolean): void;
```

Add to namespace:

```typescript
export type ProjectGroup = IVulnerabilityProjectGroup;
```

### 2. Presenter — `VulnerabilitiesPresenter.ts`

Add private state:

```typescript
private groupByProject = false;
```

In `load()`, after parsing `scannedDate` from URL params (line 95), auto-enable grouping:

```typescript
if (this.scannedDate) {
  this.groupByProject = true;
}
```

Add public method:

```typescript
public setGroupByProject = (value: boolean): void => {
    this.groupByProject = value;
};
```

Add computed property for grouped data. In the `vm` getter, compute `groupedVulnerabilities` from the sorted+paginated `vulnerabilities` array:

```typescript
groupByProject: this.groupByProject,
groupedVulnerabilities: this.groupByProject
    ? this.computeProjectGroups(vulnerabilities)
    : []
```

Add private method `computeProjectGroups`:

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

### 3. Page — `VulnerabilitiesPage.tsx`

Add `Switch` toggle in the filter bar area (near existing filters):

```tsx
<Switch
  label="Group by project"
  checked={vm.groupByProject}
  onChange={event => presenter.setGroupByProject(event.currentTarget.checked)}
/>
```

When `vm.groupByProject` is true, render `Accordion` instead of flat table:

```tsx
{vm.groupByProject ? (
    <Accordion multiple defaultValue={vm.groupedVulnerabilities.map(g => g.projectId)}>
        {vm.groupedVulnerabilities.map(group => (
            <Accordion.Item key={group.projectId} value={group.projectId}>
                <Accordion.Control>
                    <Group>
                        <Text fw={600}>{group.projectName}</Text>
                        {group.counts.critical > 0 && <Badge color="red" size="sm">{group.counts.critical} critical</Badge>}
                        {group.counts.high > 0 && <Badge color="orange" size="sm">{group.counts.high} high</Badge>}
                        {group.counts.moderate > 0 && <Badge color="yellow" size="sm">{group.counts.moderate} moderate</Badge>}
                        {group.counts.low > 0 && <Badge color="blue" size="sm">{group.counts.low} low</Badge>}
                        {group.counts.info > 0 && <Badge color="gray" size="sm">{group.counts.info} info</Badge>}
                    </Group>
                </Accordion.Control>
                <Accordion.Panel>
                    {/* Reuse existing table rendering for group.vulnerabilities */}
                </Accordion.Panel>
            </Accordion.Item>
        ))}
    </Accordion>
) : (
    // Existing flat table
)}
```

Import `Accordion` and `Switch` from `@mantine/core` (add to existing Mantine import block). Both are exported from the project's @mantine/core version.

### 4. No backend changes

Grouping is computed client-side from existing data. No new routes, no new queries.

## Grouping behavior

- Groups computed from the current page's visible vulnerabilities (post-sort, post-pagination)
- Groups sorted by total vulnerability count descending (most affected project first)
- All accordion items expanded by default (`defaultValue` includes all project IDs)
- Pagination still applies — groups are computed from the current page slice
- Bulk selection works within groups (checkboxes remain per-row)
- Toggle state resets on page reload (not persisted)

## Auto-enable behavior

- When `scannedDate` URL param is present in `load()`, set `groupByProject = true`
- When user navigates directly to `/vulnerabilities` (no param), `groupByProject` stays false
- User can toggle off even when auto-enabled
- `clearScannedDate()` does not reset `groupByProject` — user's toggle choice persists

## Testing

In `VulnerabilitiesPresenter.test.ts`:

1. `computeProjectGroups` returns correct groups with severity counts
2. Groups sorted by count descending
3. `setGroupByProject` toggles state and reflects in vm
4. Auto-enables when `scannedDate` URL param present
5. Returns empty `groupedVulnerabilities` when `groupByProject` is false
6. Single-project case: one group containing all items

## Scope

- Files modified: 3 (`abstractions/VulnerabilitiesPresenter.ts`, `VulnerabilitiesPresenter.ts`, `VulnerabilitiesPage.tsx`)
- New tests: 6 presenter tests
- Schema changes: 0
- Backend changes: 0
- New dependencies: 0 (Accordion and Switch already available in @mantine/core)
