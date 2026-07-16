# Dashboard UI Components & Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all React components for the dashboard page, add Recharts dependency, and wire up routing so dashboard is the home page.

**Architecture:** Dumb React components wrapped in `observer()`, read from `presenter.vm`. Recharts for trend chart. Routing change: `/` renders dashboard, `/projects` renders project list.

**Tech Stack:** React, Mantine UI, Recharts, MobX (`observer`), TypeScript

## Global Constraints

- Yarn 4, not npm
- oxlint for linting, oxfmt for formatting
- Named interfaces only, no inline structural types
- React components are dumb display — `observer()` wrapped, read `presenter.vm` only
- No server start — user manages dev server
- Path aliases: `#ui/*`, `#shared/*`

## Prerequisite

Plan 05 (presentation layer) must be completed first.

---

### Task 1: Add Recharts dependency

**Files:**

- Modify: `package.json` (add recharts)

- [ ] **Step 1: Add recharts**

Run: `yarn add recharts`

- [ ] **Step 2: Verify build passes**

Run: `yarn build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add recharts dependency for dashboard trend chart"
```

---

### Task 2: Dashboard page and widget components

**Files:**

- Create: `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/SummaryCards.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/HealthTrendChart.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/ProjectHealthTable.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/RecentActivityWidget.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/ScanFreshnessWidget.tsx`
- Create: `src/ui/presentation/dashboard/Dashboard/components/SecurityOverviewWidget.tsx`

**Interfaces:**

- Consumes: `DashboardPresenter.ViewModel` from plan 05

- [ ] **Step 1: Create SummaryCards component**

Create `src/ui/presentation/dashboard/Dashboard/components/SummaryCards.tsx`:

```tsx
import type React from "react";
import { Card, Group, Text, SimpleGrid } from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardPresenter } from "../abstractions/DashboardPresenter.js";

interface SummaryCardsProps {
  summary: DashboardPresenter.ViewModel["summary"];
}

function scoreColor(score: number): string {
  if (score > 80) {
    return "green";
  }
  if (score > 50) {
    return "yellow";
  }
  return "red";
}

export function SummaryCards({ summary }: SummaryCardsProps): React.ReactNode {
  if (!summary) {
    return null;
  }

  return (
    <SimpleGrid cols={3}>
      <Card shadow="sm" padding="lg" withBorder>
        <Text size="sm" c="dimmed">
          Total Projects
        </Text>
        <Text size="xl" fw={700}>
          {summary.totalProjects}
        </Text>
        <Text
          size="xs"
          c="blue"
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/projects")}
        >
          View all
        </Text>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Text size="sm" c="dimmed">
          Average Health
        </Text>
        <Text size="xl" fw={700} c={scoreColor(summary.averageScore)}>
          {summary.averageScore}%
        </Text>
      </Card>

      <Card shadow="sm" padding="lg" withBorder>
        <Text size="sm" c="dimmed">
          Worst Project
        </Text>
        {summary.worstProject ? (
          <>
            <Text size="xl" fw={700} c="red">
              {summary.worstProject.score}%
            </Text>
            <Text
              size="xs"
              c="blue"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/projects/${summary.worstProject!.id}`)}
            >
              {summary.worstProject.name}
            </Text>
          </>
        ) : (
          <Text size="xl" fw={700} c="dimmed">
            —
          </Text>
        )}
      </Card>
    </SimpleGrid>
  );
}
```

- [ ] **Step 2: Create ProjectHealthTable component**

Create `src/ui/presentation/dashboard/Dashboard/components/ProjectHealthTable.tsx`:

```tsx
import type React from "react";
import { Table, Badge, Text } from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "../../../../../features/dashboard/abstractions/DashboardGateway.js";

interface ProjectHealthTableProps {
  projects: DashboardGateway.HealthProject[];
}

function formatDelta(delta: number | null): React.ReactNode {
  if (delta === null) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  const color = delta > 0 ? "green" : delta < 0 ? "red" : "dimmed";
  const prefix = delta > 0 ? "+" : "";
  return (
    <Text size="sm" c={color}>
      {prefix}
      {delta}
    </Text>
  );
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) {
    return "Never";
  }
  return new Date(timestamp).toLocaleDateString();
}

export function ProjectHealthTable({ projects }: ProjectHealthTableProps): React.ReactNode {
  if (projects.length === 0) {
    return <Text c="dimmed">No health data yet. Scan a project to get started.</Text>;
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Project</Table.Th>
          <Table.Th>Score</Table.Th>
          <Table.Th>7d Delta</Table.Th>
          <Table.Th>Major</Table.Th>
          <Table.Th>Minor</Table.Th>
          <Table.Th>Patch</Table.Th>
          <Table.Th>Last Scanned</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {projects.map(project => (
          <Table.Tr
            key={project.projectId}
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/projects/${project.projectId}`)}
          >
            <Table.Td>{project.projectName}</Table.Td>
            <Table.Td>
              <Badge color={project.score > 80 ? "green" : project.score > 50 ? "yellow" : "red"}>
                {project.score}%
              </Badge>
            </Table.Td>
            <Table.Td>{formatDelta(project.scoreDelta)}</Table.Td>
            <Table.Td>
              {project.majorOutdated > 0 ? (
                <Badge color="red" size="sm">
                  {project.majorOutdated}
                </Badge>
              ) : (
                "0"
              )}
            </Table.Td>
            <Table.Td>
              {project.minorOutdated > 0 ? (
                <Badge color="yellow" size="sm">
                  {project.minorOutdated}
                </Badge>
              ) : (
                "0"
              )}
            </Table.Td>
            <Table.Td>
              {project.patchOutdated > 0 ? (
                <Badge color="green" size="sm">
                  {project.patchOutdated}
                </Badge>
              ) : (
                "0"
              )}
            </Table.Td>
            <Table.Td>{formatDate(project.lastScannedAt)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
```

- [ ] **Step 3: Create HealthTrendChart component**

Create `src/ui/presentation/dashboard/Dashboard/components/HealthTrendChart.tsx`:

```tsx
import type React from "react";
import { Card, SegmentedControl, Group, Text } from "@mantine/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import type { DashboardGateway } from "../../../../../features/dashboard/abstractions/DashboardGateway.js";

interface HealthTrendChartProps {
  trendData: DashboardGateway.TrendProject[];
  trendRange: string;
  onRangeChange: (range: string) => void;
}

const RANGE_OPTIONS = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "all" }
];

const LINE_COLORS = [
  "#228be6",
  "#40c057",
  "#fab005",
  "#fa5252",
  "#7950f2",
  "#15aabf",
  "#e64980",
  "#82c91e"
];

interface IChartDataPoint {
  date: string;
  [projectName: string]: string | number;
}

function buildChartData(trendData: DashboardGateway.TrendProject[]): IChartDataPoint[] {
  const dateMap = new Map<string, IChartDataPoint>();

  for (const project of trendData) {
    for (const snapshot of project.snapshots) {
      let point = dateMap.get(snapshot.date);
      if (!point) {
        point = { date: snapshot.date };
        dateMap.set(snapshot.date, point);
      }
      point[project.projectName] = snapshot.score;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function HealthTrendChart({
  trendData,
  trendRange,
  onRangeChange
}: HealthTrendChartProps): React.ReactNode {
  const chartData = buildChartData(trendData);

  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={600}>Health Trend</Text>
        <SegmentedControl
          data={RANGE_OPTIONS}
          value={trendRange}
          onChange={onRangeChange}
          size="xs"
        />
      </Group>

      {chartData.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No trend data yet.
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            {trendData.map((project, index) => (
              <Line
                key={project.projectId}
                type="monotone"
                dataKey={project.projectName}
                stroke={LINE_COLORS[index % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Create RecentActivityWidget**

Create `src/ui/presentation/dashboard/Dashboard/components/RecentActivityWidget.tsx`:

```tsx
import type React from "react";
import { Card, Text, Badge, Stack, Group } from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "../../../../../features/dashboard/abstractions/DashboardGateway.js";

interface RecentActivityWidgetProps {
  jobs: DashboardGateway.ActivityJob[];
}

const STATUS_COLOR: Record<string, string> = {
  completed: "green",
  failed: "red",
  cancelled: "yellow",
  pending: "gray",
  running: "blue"
};

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) {
    return "—";
  }
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentActivityWidget({ jobs }: RecentActivityWidgetProps): React.ReactNode {
  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={600}>Recent Activity</Text>
        <Text size="xs" c="blue" style={{ cursor: "pointer" }} onClick={() => navigate("/jobs")}>
          View all
        </Text>
      </Group>

      {jobs.length === 0 ? (
        <Text c="dimmed" size="sm">
          No recent jobs.
        </Text>
      ) : (
        <Stack gap="xs">
          {jobs.slice(0, 10).map(job => (
            <Group key={job.id} justify="space-between" wrap="nowrap">
              <Group gap="xs" wrap="nowrap">
                <Badge size="xs" variant="light">
                  {job.type}
                </Badge>
                <Text size="xs" truncate>
                  {job.referenceId}
                </Text>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Badge size="xs" color={STATUS_COLOR[job.status] ?? "gray"}>
                  {job.status}
                </Badge>
                <Text size="xs" c="dimmed">
                  {formatTimeAgo(job.startedAt)}
                </Text>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: Create ScanFreshnessWidget**

Create `src/ui/presentation/dashboard/Dashboard/components/ScanFreshnessWidget.tsx`:

```tsx
import type React from "react";
import { Card, Text, Stack, Group } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "../../../../../features/dashboard/abstractions/DashboardGateway.js";

interface ScanFreshnessWidgetProps {
  projects: DashboardGateway.StalenessProject[];
}

function formatStaleness(lastScannedAt: number | null): string {
  if (!lastScannedAt) {
    return "Never scanned";
  }
  const days = Math.floor((Date.now() - lastScannedAt) / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return "Scanned today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  return `${days} days ago`;
}

function isStale(lastScannedAt: number | null): boolean {
  if (!lastScannedAt) {
    return true;
  }
  const days = (Date.now() - lastScannedAt) / (1000 * 60 * 60 * 24);
  return days > 7;
}

export function ScanFreshnessWidget({ projects }: ScanFreshnessWidgetProps): React.ReactNode {
  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Text fw={600} mb="md">
        Scan Freshness
      </Text>

      {projects.length === 0 ? (
        <Text c="dimmed" size="sm">
          No projects yet.
        </Text>
      ) : (
        <Stack gap="xs">
          {projects.map(project => (
            <Group
              key={project.projectId}
              justify="space-between"
              wrap="nowrap"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/projects/${project.projectId}`)}
            >
              <Text size="sm" truncate>
                {project.projectName}
              </Text>
              <Group gap={4} wrap="nowrap">
                {isStale(project.lastScannedAt) && <IconAlertTriangle size={14} color="orange" />}
                <Text size="xs" c="dimmed">
                  {formatStaleness(project.lastScannedAt)}
                </Text>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </Card>
  );
}
```

Note: `@tabler/icons-react` is already used by Mantine — check if it's in `package.json`. If not, use a simple `⚠` text character instead of `IconAlertTriangle`.

- [ ] **Step 6: Create SecurityOverviewWidget**

Create `src/ui/presentation/dashboard/Dashboard/components/SecurityOverviewWidget.tsx`:

```tsx
import type React from "react";
import { Card, Text, Stack, Group, Progress } from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import type { DashboardGateway } from "../../../../../features/dashboard/abstractions/DashboardGateway.js";

interface SecurityOverviewWidgetProps {
  projects: DashboardGateway.SecurityProject[];
}

export function SecurityOverviewWidget({ projects }: SecurityOverviewWidgetProps): React.ReactNode {
  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Text fw={600} mb="md">
        Security Overview
      </Text>

      {projects.length === 0 ? (
        <Text c="dimmed" size="sm">
          No security checks yet.
        </Text>
      ) : (
        <Stack gap="xs">
          {projects.map(project => {
            const ratio =
              project.totalChecks > 0
                ? Math.round((project.passingChecks / project.totalChecks) * 100)
                : 100;
            const color = ratio === 100 ? "green" : ratio >= 50 ? "yellow" : "red";

            return (
              <Group
                key={project.projectId}
                justify="space-between"
                wrap="nowrap"
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/projects/${project.projectId}`)}
              >
                <Text size="sm" truncate style={{ flex: 1 }}>
                  {project.projectName}
                </Text>
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 140 }}>
                  <Progress value={ratio} color={color} size="sm" style={{ flex: 1 }} />
                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                    {project.passingChecks}/{project.totalChecks}
                  </Text>
                </Group>
              </Group>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
```

- [ ] **Step 7: Create DashboardPage**

Create `src/ui/presentation/dashboard/Dashboard/components/DashboardPage.tsx`:

```tsx
import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Stack, Skeleton, Text, Title, SimpleGrid } from "@mantine/core";
import type { DashboardPresenter } from "../abstractions/DashboardPresenter.js";
import { SummaryCards } from "./SummaryCards.js";
import { ProjectHealthTable } from "./ProjectHealthTable.js";
import { HealthTrendChart } from "./HealthTrendChart.js";
import { RecentActivityWidget } from "./RecentActivityWidget.js";
import { ScanFreshnessWidget } from "./ScanFreshnessWidget.js";
import { SecurityOverviewWidget } from "./SecurityOverviewWidget.js";

interface DashboardPageProps {
  presenter: DashboardPresenter.Interface;
}

export const DashboardPage = observer(function DashboardPage({
  presenter
}: DashboardPageProps): React.ReactNode {
  useEffect(() => {
    void presenter.load();
    return () => presenter.dispose();
  }, [presenter]);

  const { vm } = presenter;

  if (vm.loading) {
    return (
      <Stack>
        <Skeleton height={100} />
        <Skeleton height={200} />
        <Skeleton height={300} />
      </Stack>
    );
  }

  if (vm.error) {
    return <Text c="red">{vm.error}</Text>;
  }

  return (
    <Stack>
      <Title order={2}>Dashboard</Title>

      <SummaryCards summary={vm.summary} />

      <ProjectHealthTable projects={vm.projects} />

      <HealthTrendChart
        trendData={vm.trendData}
        trendRange={vm.trendRange}
        onRangeChange={range => presenter.setTrendRange(range)}
      />

      <SimpleGrid cols={3}>
        <RecentActivityWidget jobs={vm.activity} />
        <ScanFreshnessWidget projects={vm.staleness} />
        <SecurityOverviewWidget projects={vm.security} />
      </SimpleGrid>
    </Stack>
  );
});
```

- [ ] **Step 8: Verify build passes**

Run: `yarn build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/ui/presentation/dashboard/Dashboard/components/
git commit -m "feat: add dashboard page and widget components"
```

---

### Task 3: Routing — dashboard as home, projects at /projects

**Files:**

- Modify: `src/ui/App.tsx` (add dashboard route at `/`, move project list to `/projects`, update nav)

**Interfaces:**

- Consumes: `DashboardProvider`, `DashboardPage` from Task 2

- [ ] **Step 1: Update App.tsx imports**

Add imports:

```typescript
import { DashboardProvider } from "./presentation/dashboard/Dashboard/DashboardProvider.js";
import { DashboardPage } from "./presentation/dashboard/Dashboard/components/DashboardPage.js";
```

- [ ] **Step 2: Update AppRoutes function**

Add `/projects` route match **before** the `PROJECT_DETAIL_PATH_PATTERN` regex check (which matches `/projects/:id`). The exact string match must come first, otherwise the regex would capture `/projects` as well:

```typescript
if (path === "/projects") {
    return (
        <ProjectListProvider>
            {({ presenter }) => <ProjectListPage presenter={presenter} />}
        </ProjectListProvider>
    );
}
```

Place this right before the `const projectDetailMatch = PROJECT_DETAIL_PATH_PATTERN.exec(path);` line.

Change the default fallback (the last `return` in `AppRoutes`) from `ProjectListProvider` to `DashboardProvider`:

```typescript
return (
    <DashboardProvider>
        {({ presenter }) => <DashboardPage presenter={presenter} />}
    </DashboardProvider>
);
```

- [ ] **Step 3: Update nav header**

In the `AppShell.Header` group, add Dashboard as first link and update Projects link:

```tsx
<Anchor component="button" onClick={() => navigate("/")}>
    Dashboard
</Anchor>
<Anchor component="button" onClick={() => navigate("/projects")}>
    Projects
</Anchor>
```

- [ ] **Step 4: Verify build passes**

Run: `yarn build`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `yarn test`
Expected: All PASS

- [ ] **Step 6: Lint and format**

Run: `yarn lint:fix && yarn format:fix`

- [ ] **Step 7: Run full pipeline**

Run: `yarn full`
Expected: All checks PASS (adio, lint, format, build, test)

- [ ] **Step 8: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: wire dashboard as home page, move projects to /projects"
```
