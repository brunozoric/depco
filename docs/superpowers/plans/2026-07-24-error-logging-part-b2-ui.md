# Part B2: App Logs UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Logs page at `/logs` with filtering, pagination, expandable details, and bulk delete. Real-time updates via WebSocket.

**Architecture:** Full MVP stack: AppLogsGateway + AppLogsRepository (features layer), LoadAppLogsUseCase + DeleteAppLogsUseCase (use cases), LogBrowserPresenter (presentation), LogBrowserPage (React). Follows existing patterns from JobManager and SecuritySettings features.

**Tech Stack:** TypeScript, React 19, Mantine UI, MobX, mobx-react-lite

## Global Constraints

- oxfmt formatter, oxlint linter
- `yarn full` must pass
- Follow existing MVP patterns exactly (Gateway/Repository/UseCase/Presenter/Page)
- All MobX only in presenter layer
- Arrow function class properties for presenter actions
- `makeAutoObservable(this, { vm: computed })` in presenter constructor

---

### Task 1: AppLogs features layer (Gateway + Repository)

**Files:**

- Create: `src/ui/features/appLogs/abstractions/AppLogsGateway.ts`
- Create: `src/ui/features/appLogs/abstractions/AppLogsRepository.ts`
- Create: `src/ui/features/appLogs/abstractions/index.ts`
- Create: `src/ui/features/appLogs/AppLogsGateway.ts`
- Create: `src/ui/features/appLogs/AppLogsRepository.ts`
- Create: `src/ui/features/appLogs/feature.ts`
- Create: `src/ui/features/appLogs/index.ts`

**Interfaces:**

- Consumes: `HTTPClient`, `listLogsRoute`, `deleteLogsRoute`
- Produces: `AppLogsGateway.Interface` (list, deleteFiltered), `AppLogsRepository.Interface` (getLogs, setLogs, getTotal, setTotal)

- [ ] **Step 1: Create Gateway abstraction**

Create `src/ui/features/appLogs/abstractions/AppLogsGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IAppLogEntry {
  id: string;
  level: string;
  source: string;
  projectId: string | null;
  message: string;
  details: string | null;
  createdAt: number;
}

export interface IAppLogsFilters {
  level?: string;
  source?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

export interface IAppLogsListResponse {
  items: IAppLogEntry[];
  total: number;
}

export interface IAppLogsGateway {
  list(filters: IAppLogsFilters, limit?: number, offset?: number): Promise<IAppLogsListResponse>;
  deleteFiltered(filters: IAppLogsFilters): Promise<number>;
}

export const AppLogsGateway = createAbstraction<IAppLogsGateway>("Ui/AppLogsGateway");

export namespace AppLogsGateway {
  export type Interface = IAppLogsGateway;
  export type LogEntry = IAppLogEntry;
  export type Filters = IAppLogsFilters;
  export type ListResponse = IAppLogsListResponse;
}
```

- [ ] **Step 2: Create Repository abstraction**

Create `src/ui/features/appLogs/abstractions/AppLogsRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import { AppLogsGateway } from "./AppLogsGateway.js";

export interface IAppLogsRepository {
  getLogs(): AppLogsGateway.LogEntry[];
  setLogs(logs: AppLogsGateway.LogEntry[]): void;
  getTotal(): number;
  setTotal(total: number): void;
  prependLog(log: AppLogsGateway.LogEntry): void;
}

export const AppLogsRepository = createAbstraction<IAppLogsRepository>("Ui/AppLogsRepository");

export namespace AppLogsRepository {
  export type Interface = IAppLogsRepository;
  export type LogEntry = AppLogsGateway.LogEntry;
}
```

- [ ] **Step 3: Create abstractions barrel**

Create `src/ui/features/appLogs/abstractions/index.ts`:

```typescript
export { AppLogsGateway } from "./AppLogsGateway.js";
export { AppLogsRepository } from "./AppLogsRepository.js";
```

- [ ] **Step 4: Create Gateway implementation**

Create `src/ui/features/appLogs/AppLogsGateway.ts`:

```typescript
import { AppLogsGateway as Abstraction } from "./abstractions/AppLogsGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";

class AppLogsGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async list(
    filters: Abstraction.Filters,
    limit?: number,
    offset?: number
  ): Promise<Abstraction.ListResponse> {
    const query: Record<string, string> = {};
    if (filters.level) {
      query.level = filters.level;
    }
    if (filters.source) {
      query.source = filters.source;
    }
    if (filters.projectId) {
      query.projectId = filters.projectId;
    }
    if (filters.from) {
      query.from = filters.from;
    }
    if (filters.to) {
      query.to = filters.to;
    }
    if (limit !== undefined) {
      query.limit = String(limit);
    }
    if (offset !== undefined) {
      query.offset = String(offset);
    }

    const response = await this.httpClient.request(listLogsRoute, {
      params: {},
      query
    });
    return { items: response.items, total: response.total };
  }

  public async deleteFiltered(filters: Abstraction.Filters): Promise<number> {
    const body: Record<string, string> = {};
    if (filters.level) {
      body.level = filters.level;
    }
    if (filters.source) {
      body.source = filters.source;
    }
    if (filters.projectId) {
      body.projectId = filters.projectId;
    }
    if (filters.from) {
      body.from = filters.from;
    }
    if (filters.to) {
      body.to = filters.to;
    }

    const response = await this.httpClient.request(deleteLogsRoute, {
      params: {},
      body
    });
    return response.deleted;
  }
}

export const AppLogsGateway = Abstraction.createImplementation({
  implementation: AppLogsGatewayImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 5: Create Repository implementation**

Create `src/ui/features/appLogs/AppLogsRepository.ts`:

```typescript
import { AppLogsRepository as Abstraction } from "./abstractions/AppLogsRepository.js";

class AppLogsRepositoryImpl implements Abstraction.Interface {
  private logs: Abstraction.LogEntry[] = [];
  private total = 0;

  public getLogs(): Abstraction.LogEntry[] {
    return this.logs;
  }

  public setLogs(logs: Abstraction.LogEntry[]): void {
    this.logs = logs;
  }

  public getTotal(): number {
    return this.total;
  }

  public setTotal(total: number): void {
    this.total = total;
  }

  public prependLog(log: Abstraction.LogEntry): void {
    this.logs = [log, ...this.logs];
    this.total++;
  }
}

export const AppLogsRepository = Abstraction.createImplementation({
  implementation: AppLogsRepositoryImpl,
  dependencies: []
});
```

- [ ] **Step 6: Create feature registration and barrel**

Create `src/ui/features/appLogs/feature.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { AppLogsGateway } from "./AppLogsGateway.js";
import { AppLogsRepository } from "./AppLogsRepository.js";

export const AppLogsFeature = createFeature({
  name: "Ui/AppLogs",
  register(container: Container) {
    container.register(AppLogsGateway).inSingletonScope();
    container.register(AppLogsRepository).inSingletonScope();
  }
});
```

Create `src/ui/features/appLogs/index.ts`:

```typescript
export { AppLogsGateway } from "./abstractions/index.js";
export { AppLogsRepository } from "./abstractions/index.js";
export { AppLogsFeature } from "./feature.js";
```

- [ ] **Step 7: Verify build**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 8: Commit**

```bash
yarn format:fix
git add src/ui/features/appLogs/
git commit -m "feat: add AppLogs features layer (Gateway + Repository)"
```

---

### Task 2: AppLogs use cases

**Files:**

- Create: `src/ui/presentation/logs/useCases/abstractions/LoadAppLogsUseCase.ts`
- Create: `src/ui/presentation/logs/useCases/abstractions/DeleteAppLogsUseCase.ts`
- Create: `src/ui/presentation/logs/useCases/abstractions/index.ts`
- Create: `src/ui/presentation/logs/useCases/LoadAppLogsUseCase.ts`
- Create: `src/ui/presentation/logs/useCases/DeleteAppLogsUseCase.ts`
- Create: `src/ui/presentation/logs/useCases/feature.ts`

**Interfaces:**

- Consumes: `AppLogsGateway.Interface`, `AppLogsRepository.Interface`
- Produces: `LoadAppLogsUseCase.Interface` (execute with filters, limit, offset), `DeleteAppLogsUseCase.Interface` (execute with filters)

- [ ] **Step 1: Create use case abstractions**

Create `src/ui/presentation/logs/useCases/abstractions/LoadAppLogsUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IAppLogsFilters } from "../../../../features/appLogs/abstractions/AppLogsGateway.js";

export interface ILoadAppLogsUseCase {
  execute(filters: IAppLogsFilters, limit?: number, offset?: number): Promise<void>;
}

export const LoadAppLogsUseCase = createAbstraction<ILoadAppLogsUseCase>("Ui/LoadAppLogsUseCase");

export namespace LoadAppLogsUseCase {
  export type Interface = ILoadAppLogsUseCase;
}
```

Create `src/ui/presentation/logs/useCases/abstractions/DeleteAppLogsUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { IAppLogsFilters } from "../../../../features/appLogs/abstractions/AppLogsGateway.js";

export interface IDeleteAppLogsUseCase {
  execute(filters: IAppLogsFilters): Promise<number>;
}

export const DeleteAppLogsUseCase =
  createAbstraction<IDeleteAppLogsUseCase>("Ui/DeleteAppLogsUseCase");

export namespace DeleteAppLogsUseCase {
  export type Interface = IDeleteAppLogsUseCase;
}
```

Create `src/ui/presentation/logs/useCases/abstractions/index.ts`:

```typescript
export { LoadAppLogsUseCase } from "./LoadAppLogsUseCase.js";
export { DeleteAppLogsUseCase } from "./DeleteAppLogsUseCase.js";
```

- [ ] **Step 2: Create use case implementations**

Create `src/ui/presentation/logs/useCases/LoadAppLogsUseCase.ts`:

```typescript
import { LoadAppLogsUseCase as Abstraction } from "./abstractions/LoadAppLogsUseCase.js";
import { AppLogsGateway } from "../../../features/appLogs/abstractions/AppLogsGateway.js";
import { AppLogsRepository } from "../../../features/appLogs/abstractions/AppLogsRepository.js";

class LoadAppLogsUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: AppLogsGateway.Interface,
    private readonly repository: AppLogsRepository.Interface
  ) {}

  public execute = async (
    filters: AppLogsGateway.Filters,
    limit?: number,
    offset?: number
  ): Promise<void> => {
    const response = await this.gateway.list(filters, limit, offset);
    this.repository.setLogs(response.items);
    this.repository.setTotal(response.total);
  };
}

export const LoadAppLogsUseCase = Abstraction.createImplementation({
  implementation: LoadAppLogsUseCaseImpl,
  dependencies: [AppLogsGateway, AppLogsRepository]
});
```

Create `src/ui/presentation/logs/useCases/DeleteAppLogsUseCase.ts`:

```typescript
import { DeleteAppLogsUseCase as Abstraction } from "./abstractions/DeleteAppLogsUseCase.js";
import { AppLogsGateway } from "../../../features/appLogs/abstractions/AppLogsGateway.js";

class DeleteAppLogsUseCaseImpl implements Abstraction.Interface {
  public constructor(private readonly gateway: AppLogsGateway.Interface) {}

  public execute = async (filters: AppLogsGateway.Filters): Promise<number> => {
    return this.gateway.deleteFiltered(filters);
  };
}

export const DeleteAppLogsUseCase = Abstraction.createImplementation({
  implementation: DeleteAppLogsUseCaseImpl,
  dependencies: [AppLogsGateway]
});
```

Create `src/ui/presentation/logs/useCases/feature.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { AppLogsFeature } from "../../../features/appLogs/feature.js";
import { LoadAppLogsUseCase } from "./LoadAppLogsUseCase.js";
import { DeleteAppLogsUseCase } from "./DeleteAppLogsUseCase.js";

export const AppLogsUseCasesFeature = createFeature({
  name: "Ui/AppLogsUseCases",
  dependencies: [AppLogsFeature],
  register(container: Container) {
    container.register(LoadAppLogsUseCase);
    container.register(DeleteAppLogsUseCase);
  }
});
```

- [ ] **Step 3: Verify build**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
yarn format:fix
git add src/ui/presentation/logs/useCases/
git commit -m "feat: add AppLogs use cases (Load + Delete)"
```

---

### Task 3: LogBrowser presenter

**Files:**

- Create: `src/ui/presentation/logs/LogBrowser/abstractions/LogBrowserPresenter.ts`
- Create: `src/ui/presentation/logs/LogBrowser/abstractions/index.ts`
- Create: `src/ui/presentation/logs/LogBrowser/LogBrowserPresenter.ts`

**Interfaces:**

- Consumes: `LoadAppLogsUseCase`, `DeleteAppLogsUseCase`, `AppLogsRepository`, `ProjectsRepository`, `LoadProjectsUseCase`, `WebSocketListener`
- Produces: `LogBrowserPresenter.Interface` with vm, load, setFilter, clearFilters, toggleDetails, deleteFiltered, setPage

- [ ] **Step 1: Create presenter abstraction**

Create `src/ui/presentation/logs/LogBrowser/abstractions/LogBrowserPresenter.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ILogViewModel {
  id: string;
  level: string;
  source: string;
  projectName: string | null;
  message: string;
  details: string | null;
  createdAt: number;
}

export interface ILogBrowserViewModel {
  loading: boolean;
  error: string | null;
  logs: ILogViewModel[];
  total: number;
  levelFilter: string | null;
  sourceFilter: string | null;
  projectFilter: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
  expandedLogId: string | null;
}

export interface ILogBrowserPresenter {
  get vm(): ILogBrowserViewModel;
  load: () => Promise<void>;
  setFilter: (field: string, value: string | null) => void;
  clearFilters: () => void;
  toggleDetails: (id: string) => void;
  deleteFiltered: () => Promise<void>;
  setPage: (page: number) => void;
}

export const LogBrowserPresenter =
  createAbstraction<ILogBrowserPresenter>("Ui/LogBrowserPresenter");

export namespace LogBrowserPresenter {
  export type Interface = ILogBrowserPresenter;
  export type ViewModel = ILogBrowserViewModel;
  export type LogViewModel = ILogViewModel;
}
```

Create `src/ui/presentation/logs/LogBrowser/abstractions/index.ts`:

```typescript
export { LogBrowserPresenter } from "./LogBrowserPresenter.js";
```

- [ ] **Step 2: Create presenter implementation**

Create `src/ui/presentation/logs/LogBrowser/LogBrowserPresenter.ts`:

```typescript
import { computed, makeAutoObservable, runInAction } from "mobx";
import { LogBrowserPresenter as Abstraction } from "./abstractions/LogBrowserPresenter.js";
import { LoadAppLogsUseCase } from "../useCases/abstractions/LoadAppLogsUseCase.js";
import { DeleteAppLogsUseCase } from "../useCases/abstractions/DeleteAppLogsUseCase.js";
import { AppLogsRepository } from "../../../features/appLogs/abstractions/AppLogsRepository.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";
import { WebSocketListener } from "../../../websocket/abstractions/WebSocketListener.js";
import type { AppLogsGateway } from "../../../features/appLogs/abstractions/AppLogsGateway.js";

const PAGE_SIZE = 50;

class LogBrowserPresenterImpl implements Abstraction.Interface {
  private loading = false;
  private error: string | null = null;
  private levelFilter: string | null = null;
  private sourceFilter: string | null = null;
  private projectFilter: string | null = null;
  private dateFrom: string | null = null;
  private dateTo: string | null = null;
  private page = 0;
  private expandedLogId: string | null = null;

  public constructor(
    private readonly loadLogsUseCase: LoadAppLogsUseCase.Interface,
    private readonly deleteLogsUseCase: DeleteAppLogsUseCase.Interface,
    private readonly logsRepository: AppLogsRepository.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface,
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly webSocketListener: WebSocketListener.Interface
  ) {
    makeAutoObservable(this, { vm: computed });

    this.webSocketListener.on("log:created", data => {
      runInAction(() => {
        this.logsRepository.prependLog({
          id: data.id,
          level: data.level,
          source: data.source,
          projectId: data.projectId,
          message: data.message,
          details: null,
          createdAt: data.createdAt
        });
      });
    });
  }

  public get vm(): Abstraction.ViewModel {
    const logs: Abstraction.LogViewModel[] = this.logsRepository.getLogs().map(log => ({
      id: log.id,
      level: log.level,
      source: log.source,
      projectName: log.projectId
        ? (this.projectsRepository.getProject(log.projectId)?.name ?? log.projectId)
        : null,
      message: log.message,
      details: log.details,
      createdAt: log.createdAt
    }));

    return {
      loading: this.loading,
      error: this.error,
      logs,
      total: this.logsRepository.getTotal(),
      levelFilter: this.levelFilter,
      sourceFilter: this.sourceFilter,
      projectFilter: this.projectFilter,
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      page: this.page,
      pageSize: PAGE_SIZE,
      expandedLogId: this.expandedLogId
    };
  }

  public load = async (): Promise<void> => {
    this.loading = true;
    this.error = null;
    try {
      await Promise.all([
        this.loadLogsUseCase.execute(this.buildFilters(), PAGE_SIZE, this.page * PAGE_SIZE),
        this.loadProjectsUseCase.execute()
      ]);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to load logs";
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public setFilter = (field: string, value: string | null): void => {
    switch (field) {
      case "level":
        this.levelFilter = value;
        break;
      case "source":
        this.sourceFilter = value;
        break;
      case "project":
        this.projectFilter = value;
        break;
      case "dateFrom":
        this.dateFrom = value;
        break;
      case "dateTo":
        this.dateTo = value;
        break;
    }
    this.page = 0;
    void this.load();
  };

  public clearFilters = (): void => {
    this.levelFilter = null;
    this.sourceFilter = null;
    this.projectFilter = null;
    this.dateFrom = null;
    this.dateTo = null;
    this.page = 0;
    void this.load();
  };

  public toggleDetails = (id: string): void => {
    this.expandedLogId = this.expandedLogId === id ? null : id;
  };

  public deleteFiltered = async (): Promise<void> => {
    this.loading = true;
    this.error = null;
    try {
      await this.deleteLogsUseCase.execute(this.buildFilters());
      await this.loadLogsUseCase.execute(this.buildFilters(), PAGE_SIZE, this.page * PAGE_SIZE);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to delete logs";
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public setPage = (page: number): void => {
    this.page = page;
    void this.load();
  };

  private buildFilters(): AppLogsGateway.Filters {
    const filters: AppLogsGateway.Filters = {};
    if (this.levelFilter) {
      filters.level = this.levelFilter;
    }
    if (this.sourceFilter) {
      filters.source = this.sourceFilter;
    }
    if (this.projectFilter) {
      filters.projectId = this.projectFilter;
    }
    if (this.dateFrom) {
      filters.from = this.dateFrom;
    }
    if (this.dateTo) {
      filters.to = this.dateTo;
    }
    return filters;
  }
}

export const LogBrowserPresenter = Abstraction.createImplementation({
  implementation: LogBrowserPresenterImpl,
  dependencies: [
    LoadAppLogsUseCase,
    DeleteAppLogsUseCase,
    AppLogsRepository,
    ProjectsRepository,
    LoadProjectsUseCase,
    WebSocketListener
  ]
});
```

- [ ] **Step 3: Verify build**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
yarn format:fix
git add src/ui/presentation/logs/LogBrowser/abstractions/ src/ui/presentation/logs/LogBrowser/LogBrowserPresenter.ts
git commit -m "feat: add LogBrowser presenter with filtering and pagination"
```

---

### Task 4: LogBrowser Provider, feature, and Page

**Files:**

- Create: `src/ui/presentation/logs/LogBrowser/LogBrowserProvider.tsx`
- Create: `src/ui/presentation/logs/LogBrowser/feature.ts`
- Create: `src/ui/presentation/logs/LogBrowser/components/LogBrowserPage.tsx`
- Modify: `src/ui/App.tsx` — register features, add route + nav link

**Interfaces:**

- Consumes: `LogBrowserPresenter.Interface`
- Produces: `/logs` route with LogBrowserPage

- [ ] **Step 1: Create Provider**

Create `src/ui/presentation/logs/LogBrowser/LogBrowserProvider.tsx`:

```typescript
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { LogBrowserPresentationFeature } from "./feature.js";
import type { LogBrowserPresenter } from "./abstractions/LogBrowserPresenter.js";

interface LogBrowserProviderProps {
  children: (params: { presenter: LogBrowserPresenter.Interface }) => React.ReactNode;
}

export function LogBrowserProvider({ children }: LogBrowserProviderProps): React.ReactNode {
  const { presenter } = useFeature(LogBrowserPresentationFeature);
  return children({ presenter });
}
```

- [ ] **Step 2: Create feature**

Create `src/ui/presentation/logs/LogBrowser/feature.ts`:

```typescript
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { LogBrowserPresenter as LogBrowserPresenterAbstraction } from "./abstractions/LogBrowserPresenter.js";
import { LogBrowserPresenter } from "./LogBrowserPresenter.js";
import { AppLogsUseCasesFeature } from "../useCases/feature.js";

export interface ILogBrowserPresentationFeatureExports {
  presenter: LogBrowserPresenterAbstraction.Interface;
}

export const LogBrowserPresentationFeature = createFeature<
  void,
  ILogBrowserPresentationFeatureExports
>({
  name: "Ui/LogBrowserPresentation",
  dependencies: [AppLogsUseCasesFeature],
  register(container: Container) {
    container.register(LogBrowserPresenter);
  },
  resolve(container: Container): ILogBrowserPresentationFeatureExports {
    return {
      presenter: container.resolve(LogBrowserPresenterAbstraction)
    };
  }
});
```

- [ ] **Step 3: Create LogBrowserPage component**

Create `src/ui/presentation/logs/LogBrowser/components/LogBrowserPage.tsx`:

```tsx
import type React from "react";
import { useEffect } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Code,
  Group,
  Loader,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { navigate } from "#ui/shared/router/router.js";
import { observer } from "mobx-react-lite";
import type { LogBrowserPresenter } from "../abstractions/LogBrowserPresenter.js";

interface LogBrowserPageProps {
  presenter: LogBrowserPresenter.Interface;
}

const LEVEL_COLORS: Record<string, string> = {
  error: "red",
  warn: "orange",
  info: "blue"
};

const LEVEL_OPTIONS = [
  { label: "All levels", value: "" },
  { label: "Error", value: "error" },
  { label: "Warning", value: "warn" },
  { label: "Info", value: "info" }
];

const SOURCE_OPTIONS = [
  { label: "All sources", value: "" },
  { label: "Scan", value: "scan" },
  { label: "Upgrade", value: "upgrade" },
  { label: "Install", value: "install" },
  { label: "Step Resolver", value: "step-resolver" },
  { label: "Git", value: "git" },
  { label: "Clone", value: "clone" }
];

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export const LogBrowserPage = observer(function LogBrowserPage({
  presenter
}: LogBrowserPageProps): React.ReactNode {
  const { vm } = presenter;

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  if (vm.loading && vm.logs.length === 0) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  const totalPages = Math.ceil(vm.total / vm.pageSize);

  return (
    <Stack gap="md">
      <Group gap="sm">
        <ActionIcon variant="subtle" size="lg" onClick={() => navigate("/")}>
          &larr;
        </ActionIcon>
        <Title order={2}>Logs</Title>
      </Group>

      <Group gap="sm">
        <Select
          size="xs"
          placeholder="Level"
          data={LEVEL_OPTIONS}
          value={vm.levelFilter ?? ""}
          onChange={value => presenter.setFilter("level", value || null)}
          clearable={false}
          style={{ width: 130 }}
        />
        <Select
          size="xs"
          placeholder="Source"
          data={SOURCE_OPTIONS}
          value={vm.sourceFilter ?? ""}
          onChange={value => presenter.setFilter("source", value || null)}
          clearable={false}
          style={{ width: 150 }}
        />
        <TextInput
          size="xs"
          placeholder="From (epoch ms)"
          value={vm.dateFrom ?? ""}
          onChange={e => presenter.setFilter("dateFrom", e.currentTarget.value || null)}
          style={{ width: 160 }}
        />
        <TextInput
          size="xs"
          placeholder="To (epoch ms)"
          value={vm.dateTo ?? ""}
          onChange={e => presenter.setFilter("dateTo", e.currentTarget.value || null)}
          style={{ width: 160 }}
        />
        <Button size="xs" variant="subtle" onClick={() => presenter.clearFilters()}>
          Clear
        </Button>
      </Group>

      {vm.error && (
        <Alert color="red" title="Error">
          {vm.error}
        </Alert>
      )}

      {vm.logs.length === 0 ? (
        <Text c="dimmed">No log entries found</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Level</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th>Project</Table.Th>
              <Table.Th>Message</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {vm.logs.map(log => (
              <>
                <Table.Tr
                  key={log.id}
                  onClick={() => presenter.toggleDetails(log.id)}
                  style={{ cursor: log.details ? "pointer" : undefined }}
                >
                  <Table.Td>
                    <Text size="xs">{formatTimestamp(log.createdAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={LEVEL_COLORS[log.level] ?? "gray"}>
                      {log.level}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{log.source}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={log.projectName ? undefined : "dimmed"}>
                      {log.projectName ?? "-"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {log.message}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                {vm.expandedLogId === log.id && log.details && (
                  <Table.Tr key={`${log.id}-details`}>
                    <Table.Td colSpan={5}>
                      <Code block style={{ maxHeight: 300, overflow: "auto" }}>
                        {log.details}
                      </Code>
                    </Table.Td>
                  </Table.Tr>
                )}
              </>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Group gap="sm" justify="space-between">
        {totalPages > 1 && (
          <Pagination
            size="sm"
            total={totalPages}
            value={vm.page + 1}
            onChange={p => presenter.setPage(p - 1)}
          />
        )}
        <Button size="xs" color="red" variant="light" onClick={() => presenter.deleteFiltered()}>
          Delete {vm.total > 0 ? `(${vm.total})` : "all"}
        </Button>
      </Group>
    </Stack>
  );
});
```

- [ ] **Step 4: Wire into App.tsx**

In `src/ui/App.tsx`:

Add imports:

```typescript
import { AppLogsFeature } from "./features/appLogs/feature.js";
import { AppLogsUseCasesFeature } from "./presentation/logs/useCases/feature.js";
import { LogBrowserPresentationFeature } from "./presentation/logs/LogBrowser/feature.js";
import { LogBrowserProvider } from "./presentation/logs/LogBrowser/LogBrowserProvider.js";
import { LogBrowserPage } from "./presentation/logs/LogBrowser/components/LogBrowserPage.js";
```

Add to `ALL_FEATURES` array:

```typescript
(AppLogsFeature, AppLogsUseCasesFeature, LogBrowserPresentationFeature);
```

Add route in `AppRoutes()` (before the project detail match):

```typescript
if (path === "/logs") {
    return (
        <LogBrowserProvider>
            {({ presenter }) => <LogBrowserPage presenter={presenter} />}
        </LogBrowserProvider>
    );
}
```

Add nav link in header:

```typescript
<Anchor component="button" onClick={() => navigate("/logs")}>
    Logs
</Anchor>
```

- [ ] **Step 5: Verify build**

Run: `yarn build`
Expected: Clean build

- [ ] **Step 6: Run tests**

Run: `yarn test`
Expected: All tests pass

- [ ] **Step 7: Format and commit**

```bash
yarn format:fix
git add src/ui/presentation/logs/ src/ui/App.tsx
git commit -m "feat: add Logs page with filtering, pagination, and bulk delete"
```
