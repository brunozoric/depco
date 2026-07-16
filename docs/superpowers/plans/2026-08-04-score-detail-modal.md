# Score Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-contained modal to the dashboard health table that breaks down the health score formula, shows outdated packages with per-package score impact, and lists active vulnerabilities with per-item penalty.

**Architecture:** Extend existing dashboard data pipeline (shared route schema → API handler → UI gateway → presenter → React component). The health endpoint gains 4 vulnerability count fields already stored in `health_snapshots`. A new score-detail endpoint returns outdated packages and active vulnerabilities for one project, loaded lazily when the modal opens.

**Tech Stack:** Fastify routes with Zod schemas, Drizzle SQL, MobX presenter, Mantine UI components (Modal, Table, Badge, Skeleton, Stack, Group, Text, Button, Collapse).

## Global Constraints

- Use named interfaces, never inline structural types
- Use object params with named keys when function has 2+ params
- Use full words (e.g. "Vulnerability" not "Vuln") in new code identifiers
- Never import `*Impl` outside its own file — use abstractions + DI container
- Run `yarn full` for validation (type-check + tests + lint)
- Commit after each task

---

### Task 1: Extend Health Endpoint with Vulnerability Counts

**Files:**

- Modify: `src/shared/routes/dashboard.ts:4-15` — add 4 fields to `healthProjectSchema`
- Modify: `src/api/routes/dashboard.ts:25-36` — add 4 fields to `IRawHealthRow`
- Modify: `src/api/routes/dashboard.ts:141-167` — extend SQL query to select vulnerability columns
- Modify: `src/api/routes/dashboard.ts:169-179` — map new fields in response
- Modify: `src/ui/features/dashboard/abstractions/DashboardGateway.ts:3-14` — add 4 fields to `IHealthProject`

**Interfaces:**

- Consumes: existing `health_snapshots` table columns `vuln_critical`, `vuln_high`, `vuln_moderate`, `vuln_low`
- Produces: `IHealthProject` with 4 new fields: `vulnerabilityCritical: number`, `vulnerabilityHigh: number`, `vulnerabilityModerate: number`, `vulnerabilityLow: number`

- [ ] **Step 1: Add fields to shared route schema**

In `src/shared/routes/dashboard.ts`, add 4 fields to `healthProjectSchema`:

```typescript
const healthProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  score: z.number(),
  scoreDelta: z.number().nullable(),
  totalPackages: z.number(),
  upToDate: z.number(),
  patchOutdated: z.number(),
  minorOutdated: z.number(),
  majorOutdated: z.number(),
  lastScannedAt: z.number().nullable(),
  vulnerabilityCritical: z.number(),
  vulnerabilityHigh: z.number(),
  vulnerabilityModerate: z.number(),
  vulnerabilityLow: z.number()
});
```

- [ ] **Step 2: Add fields to IHealthProject interface**

In `src/ui/features/dashboard/abstractions/DashboardGateway.ts`, add to `IHealthProject`:

```typescript
export interface IHealthProject {
  projectId: string;
  projectName: string;
  score: number;
  scoreDelta: number | null;
  totalPackages: number;
  upToDate: number;
  patchOutdated: number;
  minorOutdated: number;
  majorOutdated: number;
  lastScannedAt: number | null;
  vulnerabilityCritical: number;
  vulnerabilityHigh: number;
  vulnerabilityModerate: number;
  vulnerabilityLow: number;
}
```

- [ ] **Step 3: Extend API route handler**

In `src/api/routes/dashboard.ts`, add fields to `IRawHealthRow`:

```typescript
interface IRawHealthRow {
  projectId: string;
  projectName: string;
  score: number;
  totalPackages: number;
  upToDate: number;
  patchOutdated: number;
  minorOutdated: number;
  majorOutdated: number;
  lastScannedAt: number | null;
  prevScore: number | null;
  vulnerabilityCritical: number;
  vulnerabilityHigh: number;
  vulnerabilityModerate: number;
  vulnerabilityLow: number;
}
```

Extend the SQL query to select vulnerability columns from `health_snapshots`:

```sql
SELECT
    hs.project_id AS projectId,
    p.name AS projectName,
    hs.score,
    hs.total_packages AS totalPackages,
    hs.up_to_date AS upToDate,
    hs.patch_outdated AS patchOutdated,
    hs.minor_outdated AS minorOutdated,
    hs.major_outdated AS majorOutdated,
    p.last_scanned_at AS lastScannedAt,
    prev.score AS prevScore,
    hs.vuln_critical AS vulnerabilityCritical,
    hs.vuln_high AS vulnerabilityHigh,
    hs.vuln_moderate AS vulnerabilityModerate,
    hs.vuln_low AS vulnerabilityLow
FROM health_snapshots hs
...
```

Add the 4 fields to the response mapping (in the `rows.map` callback):

```typescript
vulnerabilityCritical: row.vulnerabilityCritical,
vulnerabilityHigh: row.vulnerabilityHigh,
vulnerabilityModerate: row.vulnerabilityModerate,
vulnerabilityLow: row.vulnerabilityLow
```

- [ ] **Step 4: Run validation**

Run: `yarn full`
Expected: PASS — types align end-to-end, existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/routes/dashboard.ts src/api/routes/dashboard.ts src/ui/features/dashboard/abstractions/DashboardGateway.ts
git commit -m "feat(dashboard): add vulnerability counts to health endpoint"
```

---

### Task 2: Add Score Detail API Route

**Files:**

- Modify: `src/shared/routes/dashboard.ts` — add `dashboardScoreDetailRoute` definition
- Modify: `src/api/routes/dashboard.ts` — add score-detail route handler

**Interfaces:**

- Consumes: `scan_results` table (columns: `project_id`, `name`, `current_version`, `latest_version`, `upgrade_type`), `vulnerabilities` table (columns: `project_id`, `package_name`, `severity`, `title`, `fix_version`, `dismissed_at`, `dismissed_until`)
- Produces: `dashboardScoreDetailRoute` — `GET /api/dashboard/health/:projectId/score-detail` returning `{ outdatedPackages: Array<{name, currentVersion, latestVersion, upgradeType}>, vulnerabilities: Array<{packageName, severity, title, fixVersion, penalty}> }`

- [ ] **Step 1: Define shared route schema**

In `src/shared/routes/dashboard.ts`, add at the end of the file:

```typescript
const scoreDetailOutdatedPackageSchema = z.object({
  name: z.string(),
  currentVersion: z.string(),
  latestVersion: z.string(),
  upgradeType: z.enum(["major", "minor", "patch"])
});

const scoreDetailVulnerabilitySchema = z.object({
  packageName: z.string(),
  severity: z.enum(["critical", "high", "moderate", "low"]),
  title: z.string(),
  fixVersion: z.string().nullable(),
  penalty: z.number()
});

export const dashboardScoreDetailRoute = defineRoute({
  method: "GET",
  path: "/api/dashboard/health/:projectId/score-detail",
  description: "Get score breakdown detail for a single project",
  params: z.object({
    projectId: z.string()
  }),
  querystring: z.object({}),
  response: z.object({
    outdatedPackages: z.array(scoreDetailOutdatedPackageSchema),
    vulnerabilities: z.array(scoreDetailVulnerabilitySchema)
  })
});
```

- [ ] **Step 2: Add raw row interfaces and route handler**

In `src/api/routes/dashboard.ts`, add the raw row interfaces near the other `IRaw*` interfaces:

```typescript
interface IRawOutdatedPackageRow {
  name: string;
  currentVersion: string;
  latestVersion: string;
  upgradeType: string;
}

interface IRawScoreVulnerabilityRow {
  packageName: string;
  severity: string;
  title: string;
  fixVersion: string | null;
}
```

Add the route handler inside the `dashboardRoutes` function, after the last existing `registerRoute` call. Import `dashboardScoreDetailRoute` from the shared routes and `VULNERABILITY_PENALTY` from the shared types:

```typescript
import { VULNERABILITY_PENALTY } from "#shared/vulnerabilities/types.js";
```

```typescript
registerRoute(app, dashboardScoreDetailRoute, {}, async (request, reply) => {
  const { projectId } = request.params;

  const outdatedRows = await db.all<IRawOutdatedPackageRow>(sql`
        SELECT
            name,
            current_version AS currentVersion,
            latest_version AS latestVersion,
            upgrade_type AS upgradeType
        FROM scan_results
        WHERE project_id = ${projectId}
        AND upgrade_type != 'none'
        ORDER BY
            CASE upgrade_type
                WHEN 'major' THEN 1
                WHEN 'minor' THEN 2
                WHEN 'patch' THEN 3
            END,
            name ASC
    `);

  const vulnerabilityRows = await db.all<IRawScoreVulnerabilityRow>(sql`
        SELECT
            package_name AS packageName,
            severity,
            title,
            fix_version AS fixVersion
        FROM vulnerabilities
        WHERE project_id = ${projectId}
        AND (dismissed_at IS NULL OR (dismissed_until IS NOT NULL AND dismissed_until <= ${Date.now()}))
        AND severity IN ('critical', 'high', 'moderate', 'low')
        ORDER BY
            CASE severity
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'moderate' THEN 3
                WHEN 'low' THEN 4
            END,
            package_name ASC
    `);

  reply.send({
    outdatedPackages: outdatedRows.map(row => ({
      name: row.name,
      currentVersion: row.currentVersion,
      latestVersion: row.latestVersion,
      upgradeType: row.upgradeType as "major" | "minor" | "patch"
    })),
    vulnerabilities: vulnerabilityRows.map(row => ({
      packageName: row.packageName,
      severity: row.severity as "critical" | "high" | "moderate" | "low",
      title: row.title,
      fixVersion: row.fixVersion,
      penalty: VULNERABILITY_PENALTY[row.severity as keyof typeof VULNERABILITY_PENALTY] ?? 0
    }))
  });
});
```

- [ ] **Step 3: Run validation**

Run: `yarn full`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/routes/dashboard.ts src/api/routes/dashboard.ts
git commit -m "feat(dashboard): add score detail API route"
```

---

### Task 3: Add Gateway and Presenter Support for Score Modal

**Files:**

- Modify: `src/ui/features/dashboard/abstractions/DashboardGateway.ts` — add `IScoreDetailResponse` interface and `getScoreDetail` method
- Modify: `src/ui/features/dashboard/DashboardGateway.ts` — implement `getScoreDetail`
- Modify: `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts` — add modal state to ViewModel and methods to interface
- Modify: `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts` — implement modal state and lazy loading

**Interfaces:**

- Consumes: `dashboardScoreDetailRoute` from Task 2, `IHealthProject` with vulnerability counts from Task 1
- Produces: `IDashboardPresenter.openScoreModal(projectId: string): void`, `IDashboardPresenter.closeScoreModal(): void`, `IDashboardViewModel.scoreModalProjectId: string | null`, `IDashboardViewModel.scoreDetailLoading: boolean`, `IDashboardViewModel.scoreDetail: IScoreDetailResponse | null`

- [ ] **Step 1: Add score detail types to gateway abstraction**

In `src/ui/features/dashboard/abstractions/DashboardGateway.ts`, add the interfaces before the `IDashboardGateway` interface:

```typescript
export interface IScoreDetailOutdatedPackage {
  name: string;
  currentVersion: string;
  latestVersion: string;
  upgradeType: "major" | "minor" | "patch";
}

export interface IScoreDetailVulnerability {
  packageName: string;
  severity: "critical" | "high" | "moderate" | "low";
  title: string;
  fixVersion: string | null;
  penalty: number;
}

export interface IScoreDetailResponse {
  outdatedPackages: IScoreDetailOutdatedPackage[];
  vulnerabilities: IScoreDetailVulnerability[];
}
```

Add the method to `IDashboardGateway`:

```typescript
getScoreDetail(projectId: string): Promise<IScoreDetailResponse>;
```

Add the namespace exports at the bottom of the `DashboardGateway` namespace:

```typescript
export type ScoreDetailOutdatedPackage = IScoreDetailOutdatedPackage;
export type ScoreDetailVulnerability = IScoreDetailVulnerability;
export type ScoreDetailResponse = IScoreDetailResponse;
```

- [ ] **Step 2: Implement gateway method**

In `src/ui/features/dashboard/DashboardGateway.ts`, add the import for the new route:

```typescript
import {
  // ...existing imports...
  dashboardScoreDetailRoute
} from "#shared/routes/index.js";
```

Add the method to `DashboardGatewayImpl`:

```typescript
public async getScoreDetail(projectId: string): Promise<Abstraction.ScoreDetailResponse> {
    return this.httpClient.request(dashboardScoreDetailRoute, {
        params: { projectId },
        query: {}
    });
}
```

- [ ] **Step 3: Add modal state to presenter abstraction**

In `src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts`, add 3 fields to `IDashboardViewModel`:

```typescript
scoreModalProjectId: string | null;
scoreDetailLoading: boolean;
scoreDetail: DashboardGateway.ScoreDetailResponse | null;
```

Add 2 methods to `IDashboardPresenter`:

```typescript
openScoreModal: (projectId: string) => void;
closeScoreModal: () => void;
```

- [ ] **Step 4: Implement modal state in presenter**

In `src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts`, add the gateway import:

```typescript
import { DashboardGateway } from "../../../features/dashboard/abstractions/DashboardGateway.js";
```

Add private fields to `DashboardPresenterImpl`:

```typescript
private scoreModalProjectId: string | null = null;
private scoreDetailLoading = false;
private scoreDetail: DashboardGateway.ScoreDetailResponse | null = null;
```

Add to the `vm` getter return object:

```typescript
scoreModalProjectId: this.scoreModalProjectId,
scoreDetailLoading: this.scoreDetailLoading,
scoreDetail: this.scoreDetail,
```

Add the `DashboardGateway` as a constructor dependency (after `teamFilterService`):

```typescript
private readonly dashboardGateway: DashboardGateway.Interface
```

Add modal methods:

```typescript
public openScoreModal = (projectId: string): void => {
    this.scoreModalProjectId = projectId;
    this.scoreDetail = null;
    this.scoreDetailLoading = true;
    this.dashboardGateway
        .getScoreDetail(projectId)
        .then(detail => {
            runInAction(() => {
                this.scoreDetail = detail;
                this.scoreDetailLoading = false;
            });
        })
        .catch(() => {
            runInAction(() => {
                this.scoreDetailLoading = false;
            });
        });
};

public closeScoreModal = (): void => {
    this.scoreModalProjectId = null;
    this.scoreDetail = null;
    this.scoreDetailLoading = false;
};
```

Update the DI registration at the bottom to include `DashboardGateway`:

```typescript
export const DashboardPresenter = Abstraction.createImplementation({
  implementation: DashboardPresenterImpl,
  dependencies: [
    DashboardRepository,
    LoadDashboardUseCase,
    LoadVulnerabilityTrendUseCase,
    WebSocketListener,
    TeamFilterService,
    DashboardGateway
  ]
});
```

- [ ] **Step 5: Run validation**

Run: `yarn full`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/ui/features/dashboard/abstractions/DashboardGateway.ts src/ui/features/dashboard/DashboardGateway.ts src/ui/presentation/dashboard/Dashboard/abstractions/DashboardPresenter.ts src/ui/presentation/dashboard/Dashboard/DashboardPresenter.ts
git commit -m "feat(dashboard): add gateway and presenter support for score detail modal"
```

---

### Task 4: Create ScoreDetailModal Component and Wire Into Dashboard

**Files:**

- Create: `src/ui/presentation/dashboard/Dashboard/components/ScoreDetailModal.tsx`
- Modify: `src/ui/presentation/dashboard/Dashboard/components/ProjectHealthTable.tsx` — make score Badge clickable
- Modify: `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx` — render ScoreDetailModal

**Interfaces:**

- Consumes: `DashboardPresenter.ViewModel` (fields: `scoreModalProjectId`, `scoreDetailLoading`, `scoreDetail`, `projects`), `DashboardPresenter.Interface` (methods: `openScoreModal`, `closeScoreModal`), `VULNERABILITY_PENALTY` from `#shared/vulnerabilities/types.js`, `computeVulnerabilityPenalty` from `#shared/vulnerabilities/types.js`

- [ ] **Step 1: Create ScoreDetailModal component**

Create `src/ui/presentation/dashboard/Dashboard/components/ScoreDetailModal.tsx`:

```tsx
import type React from "react";
import { useState } from "react";
import { Badge, Button, Collapse, Group, Modal, Skeleton, Stack, Table, Text } from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import {
  VULNERABILITY_PENALTY,
  computeVulnerabilityPenalty
} from "#shared/vulnerabilities/types.js";
import type { DashboardGateway } from "../../../../features/dashboard/abstractions/DashboardGateway.js";
import type { DashboardPresenter } from "../abstractions/DashboardPresenter.js";

interface ScoreDetailModalProps {
  project: DashboardGateway.HealthProject | undefined;
  detail: DashboardGateway.ScoreDetailResponse | null;
  loading: boolean;
  onClose: () => void;
}

const UPGRADE_BADGE_COLOR: Record<string, string> = {
  major: "red",
  minor: "yellow",
  patch: "green"
};

const SEVERITY_BADGE_COLOR: Record<string, string> = {
  critical: "red",
  high: "orange",
  moderate: "yellow",
  low: "blue"
};

const INITIAL_VISIBLE_COUNT = 10;

function ScoreBreakdown({ project }: { project: DashboardGateway.HealthProject }): React.ReactNode {
  const baseScore =
    project.totalPackages === 0 ? 100 : (project.upToDate / project.totalPackages) * 100;

  const penalty = computeVulnerabilityPenalty({
    critical: project.vulnerabilityCritical,
    high: project.vulnerabilityHigh,
    moderate: project.vulnerabilityModerate,
    low: project.vulnerabilityLow,
    info: 0
  });

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm">Base Score</Text>
        <Group gap="xs">
          <Text size="sm" fw={600}>
            {baseScore.toFixed(1)}%
          </Text>
          <Text size="xs" c="dimmed">
            {project.upToDate} of {project.totalPackages} up-to-date
          </Text>
        </Group>
      </Group>
      <Group justify="space-between">
        <Text size="sm">Vulnerability Penalty</Text>
        <Group gap="xs">
          <Text size="sm" fw={600} c={penalty > 0 ? "red" : "dimmed"}>
            {penalty > 0 ? `-${penalty}` : "0"}
          </Text>
          <Text size="xs" c="dimmed">
            {project.vulnerabilityCritical} critical · {project.vulnerabilityHigh} high ·{" "}
            {project.vulnerabilityModerate} moderate · {project.vulnerabilityLow} low
          </Text>
        </Group>
      </Group>
      <Group
        justify="space-between"
        style={{ borderTop: "1px solid var(--mantine-color-default-border)", paddingTop: 8 }}
      >
        <Text size="sm" fw={700}>
          Final Score
        </Text>
        <Text size="sm" fw={700}>
          {project.score}%
        </Text>
      </Group>
    </Stack>
  );
}

function OutdatedPackagesSection({
  packages,
  totalPackages
}: {
  packages: DashboardGateway.ScoreDetailOutdatedPackage[];
  totalPackages: number;
}): React.ReactNode {
  const [showAll, setShowAll] = useState(false);
  const impactPerPackage = totalPackages > 0 ? (1 / totalPackages) * 100 : 0;
  const visible = showAll ? packages : packages.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMore = packages.length > INITIAL_VISIBLE_COUNT;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Outdated Packages ({packages.length})
      </Text>
      {packages.length === 0 ? (
        <Text size="sm" c="dimmed">
          All packages are up-to-date.
        </Text>
      ) : (
        <>
          <Table striped size="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Package</Table.Th>
                <Table.Th>Current</Table.Th>
                <Table.Th>Latest</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Impact</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map(pkg => (
                <Table.Tr key={pkg.name}>
                  <Table.Td>{pkg.name}</Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {pkg.currentVersion}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{pkg.latestVersion}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={UPGRADE_BADGE_COLOR[pkg.upgradeType] ?? "gray"}>
                      {pkg.upgradeType}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="green">
                      +{impactPerPackage.toFixed(1)}%
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {hasMore && (
            <Button variant="subtle" size="xs" onClick={() => setShowAll(prev => !prev)}>
              {showAll ? "Show less" : `Show all (${packages.length})`}
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}

function VulnerabilitiesSection({
  vulnerabilities
}: {
  vulnerabilities: DashboardGateway.ScoreDetailVulnerability[];
}): React.ReactNode {
  if (vulnerabilities.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Active Vulnerabilities ({vulnerabilities.length})
      </Text>
      <Table striped size="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Package</Table.Th>
            <Table.Th>Severity</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Fix</Table.Th>
            <Table.Th>Penalty</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {vulnerabilities.map((vulnerability, index) => (
            <Table.Tr key={`${vulnerability.packageName}-${index}`}>
              <Table.Td>{vulnerability.packageName}</Table.Td>
              <Table.Td>
                <Badge size="xs" color={SEVERITY_BADGE_COLOR[vulnerability.severity] ?? "gray"}>
                  {vulnerability.severity}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="xs" lineClamp={1}>
                  {vulnerability.title}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {vulnerability.fixVersion ?? "No fix"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="red">
                  -{vulnerability.penalty}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function DetailSkeleton(): React.ReactNode {
  return (
    <Stack gap="md">
      <Skeleton height={80} />
      <Skeleton height={120} />
    </Stack>
  );
}

export function ScoreDetailModal({
  project,
  detail,
  loading,
  onClose
}: ScoreDetailModalProps): React.ReactNode {
  if (!project) {
    return null;
  }

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title={`Health Score — ${project.projectName}`}
      size="lg"
    >
      <Stack gap="md">
        <ScoreBreakdown project={project} />

        {loading ? (
          <DetailSkeleton />
        ) : detail ? (
          <>
            <OutdatedPackagesSection
              packages={detail.outdatedPackages}
              totalPackages={project.totalPackages}
            />
            <VulnerabilitiesSection vulnerabilities={detail.vulnerabilities} />
          </>
        ) : null}

        <Group justify="flex-end">
          <Button
            variant="light"
            size="sm"
            onClick={() => {
              onClose();
              navigate(`/projects/${project.projectId}`);
            }}
          >
            View Project
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
```

- [ ] **Step 2: Make score Badge clickable in ProjectHealthTable**

In `src/ui/presentation/dashboard/Dashboard/components/ProjectHealthTable.tsx`, add `onScoreClick` prop:

Change the props interface:

```typescript
interface ProjectHealthTableProps {
  projects: DashboardGateway.HealthProject[];
  onScoreClick: (projectId: string) => void;
}
```

Update the function signature:

```typescript
export function ProjectHealthTable({ projects, onScoreClick }: ProjectHealthTableProps): React.ReactNode {
```

Replace the score Badge cell (the `<Table.Td>` containing the `<Badge>` around `{project.score}%`) with a clickable version. Stop the click from propagating to the row's `onClick`:

```tsx
<Table.Td>
  <Badge
    color={project.score > 80 ? "green" : project.score > 50 ? "yellow" : "red"}
    style={{ cursor: "pointer" }}
    onClick={event => {
      event.stopPropagation();
      onScoreClick(project.projectId);
    }}
  >
    {project.score}%
  </Badge>
</Table.Td>
```

- [ ] **Step 3: Wire ScoreDetailModal into DashboardPage**

In `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx`, add the import:

```typescript
import { ScoreDetailModal } from "./ScoreDetailModal.js";
```

Pass `onScoreClick` to `ProjectHealthTable`:

```tsx
<ProjectHealthTable
  projects={vm.projects}
  onScoreClick={projectId => presenter.openScoreModal(projectId)}
/>
```

Add the modal at the bottom of the `<Stack>`, before the closing `</Stack>`:

```tsx
{
  vm.scoreModalProjectId && (
    <ScoreDetailModal
      project={vm.projects.find(p => p.projectId === vm.scoreModalProjectId)}
      detail={vm.scoreDetail}
      loading={vm.scoreDetailLoading}
      onClose={() => presenter.closeScoreModal()}
    />
  );
}
```

- [ ] **Step 4: Run validation**

Run: `yarn full`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/presentation/dashboard/Dashboard/components/ScoreDetailModal.tsx src/ui/presentation/dashboard/Dashboard/components/ProjectHealthTable.tsx src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx
git commit -m "feat(dashboard): add score detail modal with breakdown, outdated packages, and vulnerabilities"
```
