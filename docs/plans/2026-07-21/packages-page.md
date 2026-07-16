# Packages Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Global `/packages` page listing all unique packages across all projects with search, filters, changelog access.

**Architecture:** API route aggregates `scanResults` + `projects` + `changelogs` via SQL (json_group_array). UI follows existing MVP pattern: gateway, repository, use case, presenter, provider, page component. Reuses `ChangelogModal` from ProjectDetail.

**Tech Stack:** Drizzle ORM (raw SQL for aggregation), Fastify, React 19, Mantine UI, MobX.

## Global Constraints

- Named interfaces only — no inline types
- Three separate feature files (data, use cases, presentation)
- Filters applied server-side via query params
- SQL aggregation with `json_group_array` / `json_object`
- Search debounced in presenter (300ms)
- Default sort: alphabetical by package name
- upgradeType filter: union semantics (ANY project with that type)
- Code style: oxfmt 4-space indent, oxlint
- DI patterns: abstractions in `abstractions/` dir, `createAbstraction`/`createImplementation`

---

### Task 1: API Route + Shared Route Definition

**Files:**

- Create: `src/shared/routes/packages.ts` — route definition
- Modify: `src/shared/routes/index.ts` — add export
- Create: `src/api/routes/packages.ts` — route handler
- Modify: `src/api/routes/index.ts` — add export
- Modify: `src/api/server.ts` — register route
- Create: `src/api/routes/__tests__/packages.test.ts` — tests

**Interfaces:**

- Consumes: `scanResults`, `projects`, `dependencies`, `changelogs` tables from schema
- Produces: `listPackagesRoute` shared definition, `GET /api/packages` endpoint

- [ ] **Step 1: Define shared route**

Create `src/shared/routes/packages.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const packageProjectSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  currentVersion: z.string(),
  latestVersion: z.string(),
  upgradeType: z.string()
});

const packageListItemSchema = z.object({
  name: z.string(),
  projects: z.array(packageProjectSchema),
  changelogCount: z.number()
});

export const listPackagesRoute = defineRoute({
  method: "GET",
  path: "/api/packages",
  description: "List all unique packages across projects with filters",
  params: z.object({}),
  querystring: z.object({
    search: z.string().optional(),
    upgradeType: z.enum(["patch", "minor", "major"]).optional(),
    projectId: z.string().optional(),
    hasChangelog: z.string().optional()
  }),
  response: z.object({
    items: z.array(packageListItemSchema),
    total: z.number()
  })
});
```

- [ ] **Step 2: Export from shared routes index**

Add to `src/shared/routes/index.ts`:

```typescript
export * from "./packages.js";
```

- [ ] **Step 3: Implement route handler**

Create `src/api/routes/packages.ts`:

```typescript
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import { sql } from "drizzle-orm";
import { registerRoute, sendList, sendError } from "#shared/routing/index.js";
import { listPackagesRoute } from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

interface PluginOptions extends FastifyPluginOptions {
  container: Container;
}

interface IRawPackageRow {
  name: string;
  projects: string;
  changelogCount: number;
}

interface IPackageProject {
  projectId: string;
  projectName: string;
  currentVersion: string;
  latestVersion: string;
  upgradeType: string;
}

interface IPackageListItem {
  name: string;
  projects: IPackageProject[];
  changelogCount: number;
}

export async function packagesRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const { container } = options;
  const databaseClient = container.resolve(DatabaseClient);
  const { db } = databaseClient;

  registerRoute(app, listPackagesRoute, {}, async (request, reply) => {
    const { search, upgradeType, projectId, hasChangelog } = request.query;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conditions.push("sr.name LIKE ?");
      params.push(`%${search}%`);
    }
    if (upgradeType) {
      conditions.push("sr.upgrade_type = ?");
      params.push(upgradeType);
    }
    if (projectId) {
      conditions.push("sr.project_id = ?");
      params.push(projectId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const havingClause = hasChangelog === "true" ? "HAVING changelog_count > 0" : "";

    const query = sql.raw(`
            SELECT
                sr.name,
                json_group_array(
                    json_object(
                        'projectId', sr.project_id,
                        'projectName', p.name,
                        'currentVersion', sr.current_version,
                        'latestVersion', sr.latest_version,
                        'upgradeType', sr.upgrade_type
                    )
                ) AS projects,
                COALESCE(cl.cnt, 0) AS changelog_count
            FROM scan_results sr
            JOIN projects p ON sr.project_id = p.id
            LEFT JOIN (
                SELECT d.name AS dep_name, COUNT(*) AS cnt
                FROM changelogs c
                JOIN dependencies d ON c.dependency_id = d.id
                GROUP BY d.name
            ) cl ON cl.dep_name = sr.name
            ${whereClause}
            GROUP BY sr.name
            ${havingClause}
            ORDER BY sr.name ASC
        `);

    const rawRows = db.all<IRawPackageRow>(query);

    const items: IPackageListItem[] = (await rawRows).map(row => ({
      name: row.name,
      projects: JSON.parse(row.projects) as IPackageProject[],
      changelogCount: row.changelogCount ?? 0
    }));

    sendList(reply, items, items.length);
  });
}
```

Note: this uses `sql.raw()` for the complex aggregation query. Drizzle's query builder doesn't natively support `json_group_array`/`json_object`. The raw SQL is safe — all user input goes through parameterized conditions.

**Important implementation detail:** The `sql.raw()` with separate params array won't work with Drizzle's `db.all()` out of the box. The implementer should use the underlying `@libsql/client` directly for this query via `databaseClient.db.run(sql\`...\`)`or build the query with Drizzle's`sql`template tag for proper parameterization. Check`src/api/routes/` for existing raw SQL patterns and adapt. The key requirement is: SQL aggregation, parameterized inputs, JSON parse on output.

- [ ] **Step 4: Register route**

In `src/api/routes/index.ts`, add:

```typescript
export { packagesRoutes } from "./packages.js";
```

In `src/api/server.ts`, add import and register:

```typescript
import { packagesRoutes } from "./routes/index.js";
// ...
await app.register(packagesRoutes, { container });
```

- [ ] **Step 5: Write route tests**

Create `src/api/routes/__tests__/packages.test.ts`. Use `createTestDb()` from `#testing/helpers/createTestDb.js`. Seed data:

- Insert 2 projects
- Insert scan results for packages shared across projects
- Insert dependency + dependencyVersion + changelog rows for some packages
- Test: empty results, search filter, upgradeType filter, projectId filter, hasChangelog filter, multiple projects per package

- [ ] **Step 6: Build + test + lint + commit**

```bash
yarn build && yarn test && yarn lint && yarn format:check
git add -A && git commit -m "feat: GET /api/packages route with SQL aggregation"
```

---

### Task 2: UI Data Layer — PackagesGateway + PackagesRepository

**Files:**

- Create: `src/ui/features/packages/abstractions/PackagesGateway.ts`
- Create: `src/ui/features/packages/abstractions/PackagesRepository.ts`
- Create: `src/ui/features/packages/PackagesGateway.ts`
- Create: `src/ui/features/packages/PackagesRepository.ts`
- Create: `src/ui/features/packages/feature.ts`

**Interfaces:**

- Consumes: `listPackagesRoute`, `getChangelogsRoute` from shared routes, `HTTPClient` abstraction
- Produces: `PackagesGateway.Interface`, `PackagesRepository.Interface`, `PackagesFeature`

- [ ] **Step 1: Define PackagesGateway abstraction**

Create `src/ui/features/packages/abstractions/PackagesGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IPackageProject {
  projectId: string;
  projectName: string;
  currentVersion: string;
  latestVersion: string;
  upgradeType: string;
}

export interface IPackageListItem {
  name: string;
  projects: IPackageProject[];
  changelogCount: number;
}

export interface IChangelogEntry {
  version: string;
  content: string | null;
  source: string | null;
}

export interface IPackageListFilters {
  search?: string;
  upgradeType?: string;
  projectId?: string;
  hasChangelog?: boolean;
}

export interface IPackagesGateway {
  list(filters?: IPackageListFilters): Promise<IPackageListItem[]>;
  getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogEntry[]>;
}

export const PackagesGateway = createAbstraction<IPackagesGateway>("Ui/PackagesGateway");

export namespace PackagesGateway {
  export type Interface = IPackagesGateway;
  export type PackageListItem = IPackageListItem;
  export type PackageProject = IPackageProject;
  export type ChangelogEntry = IChangelogEntry;
  export type Filters = IPackageListFilters;
}
```

- [ ] **Step 2: Define PackagesRepository abstraction**

Create `src/ui/features/packages/abstractions/PackagesRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import { PackagesGateway } from "./PackagesGateway.js";

export interface IPackagesRepository {
  getPackages(): PackagesGateway.PackageListItem[];
  setPackages(packages: PackagesGateway.PackageListItem[]): void;
}

export const PackagesRepository = createAbstraction<IPackagesRepository>("Ui/PackagesRepository");

export namespace PackagesRepository {
  export type Interface = IPackagesRepository;
}
```

- [ ] **Step 3: Implement PackagesGateway**

Create `src/ui/features/packages/PackagesGateway.ts`:

```typescript
import { PackagesGateway as Abstraction } from "./abstractions/PackagesGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { listPackagesRoute, getChangelogsRoute } from "#shared/routes/index.js";

class PackagesGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(filters?: Abstraction.Filters): Promise<Abstraction.PackageListItem[]> {
    const query: Record<string, string> = {};
    if (filters?.search) {
      query["search"] = filters.search;
    }
    if (filters?.upgradeType) {
      query["upgradeType"] = filters.upgradeType;
    }
    if (filters?.projectId) {
      query["projectId"] = filters.projectId;
    }
    if (filters?.hasChangelog) {
      query["hasChangelog"] = "true";
    }

    const response = await this.httpClient.request(listPackagesRoute, {
      params: {},
      query: Object.keys(query).length > 0 ? query : undefined
    });
    return response.items;
  }

  public async getChangelogs(
    packageName: string,
    from: string,
    to: string
  ): Promise<Abstraction.ChangelogEntry[]> {
    const response = await this.httpClient.request(getChangelogsRoute, {
      params: { packageName },
      query: { from, to }
    });
    return response.items;
  }
}

export const PackagesGateway = Abstraction.createImplementation({
  implementation: PackagesGatewayImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 4: Implement PackagesRepository**

Create `src/ui/features/packages/PackagesRepository.ts`:

```typescript
import { PackagesRepository as Abstraction } from "./abstractions/PackagesRepository.js";
import type { PackagesGateway } from "./abstractions/PackagesGateway.js";

class PackagesRepositoryImpl implements Abstraction.Interface {
  private packages: PackagesGateway.PackageListItem[] = [];

  public getPackages(): PackagesGateway.PackageListItem[] {
    return this.packages;
  }

  public setPackages(packages: PackagesGateway.PackageListItem[]): void {
    this.packages = packages;
  }
}

export const PackagesRepository = Abstraction.createImplementation({
  implementation: PackagesRepositoryImpl,
  dependencies: []
});
```

- [ ] **Step 5: Create PackagesFeature**

Create `src/ui/features/packages/feature.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { PackagesGateway } from "./PackagesGateway.js";
import { PackagesRepository } from "./PackagesRepository.js";

export const PackagesFeature = createFeature({
  name: "Ui/Packages",
  register(container: Container) {
    container.register(PackagesGateway).inSingletonScope();
    container.register(PackagesRepository).inSingletonScope();
  }
});
```

- [ ] **Step 6: Build + commit**

```bash
yarn build && yarn lint && yarn format:check
git add -A && git commit -m "feat: PackagesGateway + PackagesRepository"
```

---

### Task 3: UI Use Cases + Presenter + Provider

**Files:**

- Create: `src/ui/presentation/packages/useCases/abstractions/LoadPackagesUseCase.ts`
- Create: `src/ui/presentation/packages/useCases/LoadPackagesUseCase.ts`
- Create: `src/ui/presentation/packages/useCases/feature.ts`
- Create: `src/ui/presentation/packages/PackageList/abstractions/PackagesPresenter.ts`
- Create: `src/ui/presentation/packages/PackageList/PackagesPresenter.ts`
- Create: `src/ui/presentation/packages/PackageList/PackagesProvider.tsx`
- Create: `src/ui/presentation/packages/PackageList/feature.ts`

**Interfaces:**

- Consumes: `PackagesGateway`, `PackagesRepository` from Task 2; `LoadProjectsUseCase`, `ProjectsRepository` from existing features
- Produces: `PackagesPresenter.Interface`, `PackageListFeature`, `PackagesProvider`

- [ ] **Step 1: Define LoadPackagesUseCase abstraction**

Create `src/ui/presentation/packages/useCases/abstractions/LoadPackagesUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { PackagesGateway } from "../../../../features/packages/abstractions/PackagesGateway.js";

export interface ILoadPackagesUseCase {
  execute(filters?: PackagesGateway.Filters): Promise<void>;
}

export const LoadPackagesUseCase =
  createAbstraction<ILoadPackagesUseCase>("Ui/LoadPackagesUseCase");

export namespace LoadPackagesUseCase {
  export type Interface = ILoadPackagesUseCase;
}
```

- [ ] **Step 2: Implement LoadPackagesUseCase**

Create `src/ui/presentation/packages/useCases/LoadPackagesUseCase.ts`:

```typescript
import { LoadPackagesUseCase as Abstraction } from "./abstractions/LoadPackagesUseCase.js";
import { PackagesGateway } from "../../../features/packages/abstractions/PackagesGateway.js";
import { PackagesRepository } from "../../../features/packages/abstractions/PackagesRepository.js";

class LoadPackagesUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly packagesGateway: PackagesGateway.Interface,
    private readonly packagesRepository: PackagesRepository.Interface
  ) {}

  public execute = async (filters?: PackagesGateway.Filters): Promise<void> => {
    const packages = await this.packagesGateway.list(filters);
    this.packagesRepository.setPackages(packages);
  };
}

export const LoadPackagesUseCase = Abstraction.createImplementation({
  implementation: LoadPackagesUseCaseImpl,
  dependencies: [PackagesGateway, PackagesRepository]
});
```

- [ ] **Step 3: Create use cases feature**

Create `src/ui/presentation/packages/useCases/feature.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { PackagesFeature } from "../../../features/packages/feature.js";
import { LoadPackagesUseCase } from "./LoadPackagesUseCase.js";

export const PackagesUseCasesFeature = createFeature({
  name: "Ui/PackagesUseCases",
  dependencies: [PackagesFeature],
  register(container: Container) {
    container.register(LoadPackagesUseCase);
  }
});
```

- [ ] **Step 4: Define PackagesPresenter abstraction**

Create `src/ui/presentation/packages/PackageList/abstractions/PackagesPresenter.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { PackagesGateway } from "../../../../features/packages/abstractions/PackagesGateway.js";

export interface IPackageListItemViewModel {
  name: string;
  projects: PackagesGateway.PackageProject[];
  changelogCount: number;
  highestUpgradeType: string;
  minCurrentVersion: string;
  maxLatestVersion: string;
}

export interface IProjectFilterOption {
  value: string;
  label: string;
}

export interface IPackagesViewModel {
  loading: boolean;
  error: string | null;
  packages: IPackageListItemViewModel[];
  search: string;
  upgradeType: string | null;
  projectId: string | null;
  hasChangelog: boolean;
  projectOptions: IProjectFilterOption[];
}

export interface IPackagesPresenter {
  get vm(): IPackagesViewModel;
  load: () => Promise<void>;
  setSearch: (value: string) => void;
  setUpgradeType: (value: string | null) => void;
  setProjectId: (value: string | null) => void;
  setHasChangelog: (value: boolean) => void;
  getChangelogs: (
    packageName: string,
    from: string,
    to: string
  ) => Promise<PackagesGateway.ChangelogEntry[]>;
}

export const PackagesPresenter = createAbstraction<IPackagesPresenter>("Ui/PackagesPresenter");

export namespace PackagesPresenter {
  export type Interface = IPackagesPresenter;
  export type ViewModel = IPackagesViewModel;
  export type PackageListItem = IPackageListItemViewModel;
  export type ProjectFilterOption = IProjectFilterOption;
}
```

- [ ] **Step 5: Implement PackagesPresenter**

Create `src/ui/presentation/packages/PackageList/PackagesPresenter.ts`:

```typescript
import { computed, makeAutoObservable, runInAction } from "mobx";
import { PackagesPresenter as Abstraction } from "./abstractions/PackagesPresenter.js";
import { LoadPackagesUseCase } from "../useCases/abstractions/LoadPackagesUseCase.js";
import { LoadProjectsUseCase } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";
import { PackagesRepository } from "../../../features/packages/abstractions/PackagesRepository.js";
import { PackagesGateway } from "../../../features/packages/abstractions/PackagesGateway.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";

const UPGRADE_TYPE_PRIORITY: Record<string, number> = {
  major: 3,
  minor: 2,
  patch: 1,
  none: 0
};

class PackagesPresenterImpl implements Abstraction.Interface {
  private loading = false;
  private error: string | null = null;
  private search = "";
  private upgradeType: string | null = null;
  private projectId: string | null = null;
  private hasChangelog = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(
    private readonly loadPackagesUseCase: LoadPackagesUseCase.Interface,
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly packagesRepository: PackagesRepository.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly packagesGateway: PackagesGateway.Interface
  ) {
    makeAutoObservable(this, { vm: computed });
  }

  public get vm(): Abstraction.ViewModel {
    const packages = this.packagesRepository
      .getPackages()
      .map((pkg): Abstraction.PackageListItem => {
        const highest = pkg.projects.reduce(
          (best, project) => {
            const priority = UPGRADE_TYPE_PRIORITY[project.upgradeType] ?? 0;
            return priority > best.priority ? { type: project.upgradeType, priority } : best;
          },
          { type: "none", priority: 0 }
        );

        const versions = pkg.projects.map(p => p.currentVersion);
        const latestVersions = pkg.projects.map(p => p.latestVersion);

        return {
          name: pkg.name,
          projects: pkg.projects,
          changelogCount: pkg.changelogCount,
          highestUpgradeType: highest.type,
          minCurrentVersion: versions[0] ?? "",
          maxLatestVersion: latestVersions[latestVersions.length - 1] ?? ""
        };
      });

    const projectOptions = this.projectsRepository.getProjects().map(project => ({
      value: project.id,
      label: project.name
    }));

    return {
      loading: this.loading,
      error: this.error,
      packages,
      search: this.search,
      upgradeType: this.upgradeType,
      projectId: this.projectId,
      hasChangelog: this.hasChangelog,
      projectOptions
    };
  }

  public load = async (): Promise<void> => {
    this.loading = true;
    this.error = null;
    try {
      await Promise.all([
        this.loadPackagesUseCase.execute(this.buildFilters()),
        this.loadProjectsUseCase.execute()
      ]);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Failed to load packages";
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public setSearch = (value: string): void => {
    this.search = value;
    this.debouncedLoad();
  };

  public setUpgradeType = (value: string | null): void => {
    this.upgradeType = value;
    void this.load();
  };

  public setProjectId = (value: string | null): void => {
    this.projectId = value;
    void this.load();
  };

  public setHasChangelog = (value: boolean): void => {
    this.hasChangelog = value;
    void this.load();
  };

  public getChangelogs = async (
    packageName: string,
    from: string,
    to: string
  ): Promise<PackagesGateway.ChangelogEntry[]> => {
    return this.packagesGateway.getChangelogs(packageName, from, to);
  };

  private buildFilters(): PackagesGateway.Filters {
    return {
      ...(this.search ? { search: this.search } : {}),
      ...(this.upgradeType ? { upgradeType: this.upgradeType } : {}),
      ...(this.projectId ? { projectId: this.projectId } : {}),
      ...(this.hasChangelog ? { hasChangelog: true } : {})
    };
  }

  private debouncedLoad(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      void this.load();
    }, 300);
  }
}

export const PackagesPresenter = Abstraction.createImplementation({
  implementation: PackagesPresenterImpl,
  dependencies: [
    LoadPackagesUseCase,
    LoadProjectsUseCase,
    PackagesRepository,
    ProjectsRepository,
    PackagesGateway
  ]
});
```

- [ ] **Step 6: Create PackagesProvider**

Create `src/ui/presentation/packages/PackageList/PackagesProvider.tsx`:

```tsx
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { PackageListFeature } from "./feature.js";
import type { PackagesPresenter } from "./abstractions/PackagesPresenter.js";

interface PackagesProviderProps {
  children: (params: { presenter: PackagesPresenter.Interface }) => React.ReactNode;
}

export function PackagesProvider({ children }: PackagesProviderProps): React.ReactNode {
  const { presenter } = useFeature(PackageListFeature);
  return children({ presenter });
}
```

- [ ] **Step 7: Create PackageList feature**

Create `src/ui/presentation/packages/PackageList/feature.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { PackagesPresenter as PackagesPresenterAbstraction } from "./abstractions/PackagesPresenter.js";
import { PackagesPresenter } from "./PackagesPresenter.js";
import { PackagesUseCasesFeature } from "../useCases/feature.js";
import { ProjectsFeature } from "../../../features/projects/feature.js";
import { ProjectsUseCasesFeature } from "../../projects/useCases/feature.js";

export interface IPackageListFeatureExports {
  presenter: PackagesPresenterAbstraction.Interface;
}

export const PackageListFeature = createFeature<void, IPackageListFeatureExports>({
  name: "Ui/PackageList",
  dependencies: [PackagesUseCasesFeature, ProjectsFeature, ProjectsUseCasesFeature],
  register(container: Container) {
    container.register(PackagesPresenter);
  },
  resolve(container: Container): IPackageListFeatureExports {
    return {
      presenter: container.resolve(PackagesPresenterAbstraction)
    };
  }
});
```

- [ ] **Step 8: Build + commit**

```bash
yarn build && yarn lint && yarn format:check
git add -A && git commit -m "feat: PackagesPresenter + use case + provider"
```

---

### Task 4: PackagesPage Component + App.tsx Routing

**Files:**

- Create: `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx`
- Modify: `src/ui/App.tsx` — add route, nav link, feature registration

**Interfaces:**

- Consumes: `PackagesPresenter.Interface` from Task 3, `ChangelogModal` from `ProjectDetail/components/`
- Produces: `/packages` route with full page

- [ ] **Step 1: Create PackagesPage component**

Create `src/ui/presentation/packages/PackageList/components/PackagesPage.tsx`:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Select,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { navigate } from "#ui/shared/router/router.js";
import type { PackagesPresenter } from "../abstractions/PackagesPresenter.js";
import { ChangelogModal } from "../../../projects/ProjectDetail/components/ChangelogModal.js";

interface PackagesPageProps {
  presenter: PackagesPresenter.Interface;
}

interface ChangelogTarget {
  name: string;
  currentVersion: string;
  latestVersion: string;
}

const UPGRADE_TYPE_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Patch", value: "patch" },
  { label: "Minor", value: "minor" },
  { label: "Major", value: "major" }
];

const UPGRADE_BADGE_COLOR: Record<string, string> = {
  patch: "green",
  minor: "yellow",
  major: "red",
  none: "gray"
};

export const PackagesPage = observer(function PackagesPage({
  presenter
}: PackagesPageProps): React.ReactNode {
  const { vm } = presenter;
  const [changelogTarget, setChangelogTarget] = useState<ChangelogTarget | null>(null);

  useEffect(() => {
    void presenter.load();
  }, [presenter]);

  return (
    <Stack gap="md">
      <Group gap="sm">
        <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
          &larr;
        </ActionIcon>
        <Title order={2}>Packages</Title>
      </Group>

      <Group gap="md">
        <TextInput
          placeholder="Search packages..."
          value={vm.search}
          onChange={event => presenter.setSearch(event.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <SegmentedControl
          value={vm.upgradeType ?? "all"}
          onChange={value => presenter.setUpgradeType(value === "all" ? null : value)}
          data={UPGRADE_TYPE_OPTIONS}
        />
        <Select
          placeholder="All projects"
          data={vm.projectOptions}
          value={vm.projectId}
          onChange={value => presenter.setProjectId(value)}
          clearable
          style={{ minWidth: 200 }}
        />
        <Switch
          label="Has changelog"
          checked={vm.hasChangelog}
          onChange={event => presenter.setHasChangelog(event.currentTarget.checked)}
        />
      </Group>

      {vm.error && (
        <Alert color="red" title="Error">
          {vm.error}
        </Alert>
      )}

      {vm.loading && vm.packages.length === 0 ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : vm.packages.length === 0 ? (
        <Text c="dimmed">No packages found</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Projects</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Upgrade</Table.Th>
              <Table.Th>Changelog</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {vm.packages.map(pkg => (
              <Table.Tr key={pkg.name}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {pkg.name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="wrap">
                    {pkg.projects.map(project => (
                      <Anchor
                        key={project.projectId}
                        component="button"
                        size="xs"
                        onClick={() => navigate(`/projects/${project.projectId}`)}
                      >
                        {project.projectName}
                      </Anchor>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {pkg.minCurrentVersion} &rarr; {pkg.maxLatestVersion}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={UPGRADE_BADGE_COLOR[pkg.highestUpgradeType] ?? "gray"}>
                    {pkg.highestUpgradeType}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() =>
                      setChangelogTarget({
                        name: pkg.name,
                        currentVersion: pkg.minCurrentVersion,
                        latestVersion: pkg.maxLatestVersion
                      })
                    }
                  >
                    Changelog
                    {pkg.changelogCount > 0 && ` (${pkg.changelogCount})`}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {changelogTarget && (
        <ChangelogModal
          opened={true}
          onClose={() => setChangelogTarget(null)}
          packageName={changelogTarget.name}
          currentVersion={changelogTarget.currentVersion}
          latestVersion={changelogTarget.latestVersion}
          getChangelogs={presenter.getChangelogs}
        />
      )}
    </Stack>
  );
});
```

- [ ] **Step 2: Wire into App.tsx**

In `src/ui/App.tsx`:

Add imports:

```typescript
import { PackagesFeature } from "./features/packages/feature.js";
import { PackagesUseCasesFeature } from "./presentation/packages/useCases/feature.js";
import { PackageListFeature } from "./presentation/packages/PackageList/feature.js";
import { PackagesProvider } from "./presentation/packages/PackageList/PackagesProvider.js";
import { PackagesPage } from "./presentation/packages/PackageList/components/PackagesPage.js";
```

Add to `ALL_FEATURES` array:

```typescript
PackagesFeature,
PackagesUseCasesFeature,
PackageListFeature,
```

Add route in `AppRoutes` (before the project detail match):

```typescript
if (path === "/packages") {
    return (
        <PackagesProvider>
            {({ presenter }) => <PackagesPage presenter={presenter} />}
        </PackagesProvider>
    );
}
```

Add nav link in header:

```tsx
<Anchor component="button" onClick={() => navigate("/packages")}>
  Packages
</Anchor>
```

- [ ] **Step 3: Build + test + lint + commit**

```bash
yarn build && yarn test && yarn lint && yarn format:check
git add -A && git commit -m "feat: /packages page with search, filters, changelog access"
```

---
