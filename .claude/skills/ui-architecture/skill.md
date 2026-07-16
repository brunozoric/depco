---
name: ui-architecture
description: Use when building any UI feature, page, or presentation component. Defines the mandatory MVP layers (Gateway → Repository → UseCase → Presenter → React), DI scoping, naming, and anti-patterns. Invoke BEFORE writing any UI code.
---

# UI Architecture — MVP with Dependency Injection

The UI follows a strict layered architecture: **Gateway → Repository → UseCase → Presenter → React**. React is a dumb display layer. All state, logic, and data transformation live in plain TypeScript classes wired through `@webiny/di`.

## Layer Rules

```
React (display only) ← reads vm, calls actions
  ↑ useFeature() → hook
Presenter (MobX observable) ← owns vm() getter, the single source of UI truth
  ↑ DI constructor injection
UseCase (required) ← all reads and writes; presenters never touch repos/gateways
  ↑
Repository (plain class) ← holds domain state, NOT MobX observable
  ↑
Gateway (HTTP calls) ← translates API responses to domain types
```

| Layer      | Required | MobX                 | Holds state   | React access    | DI Scope    |
| ---------- | -------- | -------------------- | ------------- | --------------- | ----------- |
| Gateway    | Yes      | No                   | No            | Never           | Singleton   |
| Repository | Yes      | No                   | Yes           | Never           | Singleton   |
| UseCase    | Yes      | No                   | No            | Never           | Transient   |
| Presenter  | Yes      | `makeAutoObservable` | Yes (derived) | Via `vm()` only | Transient\* |

\* **Shared presenter exception:** When a presenter is injected as a DI dependency of another presenter (e.g., form presenter coordinated by a list presenter), register it as **singleton**. Otherwise the injecting presenter and the view resolve different instances and state changes are invisible.

## Directory Structure

```
ui/src/
├── features/                  # Headless layer (Gateway + Repository)
│   └── {featureName}/
│       ├── abstractions.ts    # All interfaces + DI tokens + namespace types
│       ├── {Feature}Gateway.ts
│       ├── {Feature}Repository.ts
│       └── feature.ts
└── presentation/              # Presentation layer (Presenter + React)
    └── {domain}/
        └── {section}/         # Group pages by section (e.g. roles/, shell/)
            └── {Page}/
                ├── abstractions.ts    # Presenter + ViewModel interfaces
                ├── {Page}Presenter.ts
                ├── {Page}Provider.tsx  # Render-props provider
                ├── feature.ts
                └── components/
                    └── {Page}Page.tsx
```

## Abstractions — All Types in Namespace

```ts
// features/{name}/abstractions.ts
import { createAbstraction } from "shared";

interface IPlatformOverview {
  totalOrganizations: number;
  totalUsers: number;
  totalLocations: number;
}

interface IPlatformAdminGateway {
  getOverview(): Promise<IPlatformOverview>;
}

export const PlatformAdminGateway =
  createAbstraction<IPlatformAdminGateway>("PlatformAdminGateway");

export namespace PlatformAdminGateway {
  export type Interface = IPlatformAdminGateway;
  export type PlatformOverview = IPlatformOverview;
}
```

- All types live inside the namespace — no top-level type exports.
- Never use inline structural types: `get<{ user: User }>()` is wrong. Use `get<Gateway.GetMeResponse>()`.

## Gateway — HTTP Only

`HTTPClient` methods return `Promise<Result<T, HTTPError>>` — gateways must handle both success and error cases. Never call `schema.parse()` manually on responses. Instead, pass `responseSchema` to the HTTPClient — it parses internally, coercing types like `z.coerce.date()` so timestamp fields arrive as real `Date` objects at runtime.

**Every gateway method that returns response data MUST pass `responseSchema`.** Without it, JSON timestamps remain strings despite the TypeScript `Date` type.

```ts
import { PlatformAdminGateway as GatewayAbstraction } from "./abstractions.js";
import { HTTPClient } from "../httpClient/abstractions.js";
import {
  getOverviewResponseSchema,
  type GetOverviewResponse
} from "shared/platformAdmin/responses/GetOverview.js";

class PlatformAdminGatewayImpl implements GatewayAbstraction.Interface {
  constructor(private readonly httpClient: HTTPClient.Interface) {}

  async getOverview(): Promise<Result<GatewayAbstraction.PlatformOverview, HTTPError>> {
    const result = await this.httpClient.get<GetOverviewResponse>("/superadmin/overview", {
      responseSchema: getOverviewResponseSchema
    });
    return result.map(data => data.overview);
  }
}

export const PlatformAdminGateway = GatewayAbstraction.createImplementation({
  implementation: PlatformAdminGatewayImpl,
  dependencies: [HTTPClient]
});
```

## Repository — Plain Class, NO MobX

```ts
import {
  PlatformAdminRepository as RepositoryAbstraction,
  PlatformAdminGateway
} from "./abstractions.js";

class PlatformAdminRepositoryImpl implements RepositoryAbstraction.Interface {
  private overview: PlatformAdminGateway.PlatformOverview | null = null;

  constructor(private readonly platformAdminGateway: PlatformAdminGateway.Interface) {}

  getOverview(): PlatformAdminGateway.PlatformOverview | null {
    return this.overview;
  }

  async loadOverview(): Promise<void> {
    this.overview = await this.platformAdminGateway.getOverview();
  }
}

export const PlatformAdminRepository = RepositoryAbstraction.createImplementation({
  implementation: PlatformAdminRepositoryImpl,
  dependencies: [PlatformAdminGateway]
});
```

- No `makeAutoObservable`. Repository is a plain class.
- Uses getter methods to expose state, not MobX-computed getters.

## Presenter — The Only MobX Layer

```ts
// presentation/{domain}/{Page}/abstractions.ts
import { createAbstraction } from "shared";

interface IPlatformAdminDashboardViewModel {
  loading: boolean;
  totalOrganizations: number;
  totalUsers: number;
  totalLocations: number;
}

interface IPlatformAdminDashboardPresenter {
  get vm(): IPlatformAdminDashboardViewModel;
  load(): Promise<void>;
}

export const PlatformAdminDashboardPresenter = createAbstraction<IPlatformAdminDashboardPresenter>(
  "PlatformAdminDashboardPresenter"
);

export namespace PlatformAdminDashboardPresenter {
  export type Interface = IPlatformAdminDashboardPresenter;
  export type ViewModel = IPlatformAdminDashboardViewModel;
}
```

```ts
// presentation/{domain}/{Page}/{Page}Presenter.ts
import { makeAutoObservable, runInAction, computed } from "mobx";
import { PlatformAdminDashboardPresenter as PresenterAbstraction } from "./abstractions.js";
import { LoadOverviewUseCase } from "./useCases/LoadOverviewUseCase.js";

class PlatformAdminDashboardPresenterImpl implements PresenterAbstraction.Interface {
  private loading = false;
  private overview: LoadOverviewUseCase.Response | null = null;

  constructor(private readonly loadOverviewUseCase: LoadOverviewUseCase.Interface) {
    makeAutoObservable(this, { vm: computed });
  }

  get vm(): PresenterAbstraction.ViewModel {
    return {
      loading: this.loading,
      totalOrganizations: this.overview?.totalOrganizations ?? 0,
      totalUsers: this.overview?.totalUsers ?? 0,
      totalLocations: this.overview?.totalLocations ?? 0
    };
  }

  load = async (): Promise<void> => {
    this.loading = true;

    try {
      const result = await this.loadOverviewUseCase.execute();

      runInAction(() => {
        this.overview = result;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };
}

export const PlatformAdminDashboardPresenter = PresenterAbstraction.createImplementation({
  implementation: PlatformAdminDashboardPresenterImpl,
  dependencies: [LoadOverviewUseCase]
});
```

- `makeAutoObservable(this, { vm: computed })` in constructor.
- `vm` is a computed getter returning a plain object.
- All methods (except `vm`) must be **arrow function class properties** — not traditional class methods. This lexically binds `this`, eliminating `.bind()` in hooks.
- **Presenter owns all navigation.** Navigate via `RouterRepository` (or route adapter for dual-context features). Components never call `useRouter()` or navigate directly.
- **Presenter provides correct values.** Views never do `value ?? ""` or null coercion — the vm returns view-ready data. FormModel fields use `.defaultValue("")` to prevent null.
- Async mutations in `runInAction()`.
- Registered as transient — each component gets its own instance.

## Feature Registration

```ts
// features/{name}/feature.ts — headless
import type { Container } from "@webiny/di";
import { createFeature } from "shared";
import { PlatformAdminGateway } from "./PlatformAdminGateway.js";
import { PlatformAdminRepository } from "./PlatformAdminRepository.js";

export const PlatformAdminFeature = createFeature<void, void>({
  name: "PlatformAdmin",
  register(container: Container) {
    container.register(PlatformAdminGateway).inSingletonScope();
    container.register(PlatformAdminRepository).inSingletonScope();
  },
  resolve() {}
});
```

```ts
// presentation/{domain}/{Page}/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "shared";
import { PlatformAdminDashboardPresenter } from "./abstractions.js";
import { PlatformAdminDashboardPresenter as PlatformAdminDashboardPresenterImpl } from "./PlatformAdminDashboardPresenter.js";

interface IPlatformAdminDashboardFeatureExports {
  presenter: PlatformAdminDashboardPresenter.Interface;
}

export const PlatformAdminDashboardFeature = createFeature<
  void,
  IPlatformAdminDashboardFeatureExports
>({
  name: "PlatformAdminDashboard",
  register(container: Container) {
    container.register(PlatformAdminDashboardPresenterImpl);
  },
  resolve(container: Container): IPlatformAdminDashboardFeatureExports {
    return {
      presenter: container.resolve(PlatformAdminDashboardPresenter)
    };
  }
});
```

- `register()` must be sync.
- Headless features register as singleton. Presentation features register as transient — **unless** the presenter is injected as a dependency by another presenter (shared presenters must be singleton; see DI Scoping).

## React Integration

### Provider (render props)

```tsx
import type React from "react";
import { useFeature } from "~/shared/di/useFeature.js";
import { PlatformAdminDashboardFeature } from "./feature.js";
import type { PlatformAdminDashboardPresenter } from "./abstractions.js";

interface PlatformAdminDashboardProviderProps {
  children: (params: { presenter: PlatformAdminDashboardPresenter.Interface }) => React.ReactNode;
}

export function PlatformAdminDashboardProvider({ children }: PlatformAdminDashboardProviderProps) {
  const { presenter } = useFeature(PlatformAdminDashboardFeature);
  return children({ presenter });
}
```

### Page Component

```tsx
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Card, Center, Group, Loader, Stack, Text, Title } from "~/components/index.js";
import type { PlatformAdminDashboardPresenter } from "../abstractions.js";

interface PlatformAdminDashboardPageProps {
  presenter: PlatformAdminDashboardPresenter.Interface;
}

export const PlatformAdminDashboardPage = observer(function PlatformAdminDashboardPage({
  presenter
}: PlatformAdminDashboardPageProps) {
  const { vm } = presenter;

  useEffect(() => {
    presenter.load();
  }, [presenter]);

  if (vm.loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Platform Overview</Title>
      <Group gap="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text size="xl" fw={700}>
            {vm.totalOrganizations}
          </Text>
          <Text size="sm" c="dimmed">
            Organizations
          </Text>
        </Card>
      </Group>
    </Stack>
  );
});
```

- Wrap with `observer()` from `mobx-react-lite`.
- All Mantine imports via `~/components/index.js` — never `@mantine/core`.
- All icon imports via `~/icons/index.js` — never `@tabler/icons-react`.
- Minimize `useEffect` / `useRef` — only for load-on-mount (`useEffect(() => load(), [load])`). Business logic, guards, and side effects belong in presenters.
- Zero business logic, zero data transformation.

## Domain Aggregates

Each domain exports a component (registers all features) and a routes array. App.tsx only composes domains — it never registers individual features.

```
ui/src/domains/
├── auth/AuthDomain.tsx
├── core/CoreDomain.tsx
├── locations/LocationsDomain.tsx
├── organizations/OrganizationsDomain.tsx
├── roles/RolesDomain.tsx
└── users/UsersDomain.tsx
```

```tsx
// domains/{name}/{Name}Domain.tsx
export function LocationsDomain() {
  return (
    <>
      <RegisterFeature feature={LocationsFeature} />
      <RegisterFeature feature={TimezonesFeature} />
      <RegisterFeature feature={LocationsRouteAdapterFeature} />
      <RegisterFeature feature={LocationsListFeature} />
      <RegisterFeature feature={LocationFormFeature} />
    </>
  );
}

export const locationsRoutes: RouteDefinition[] = [
  {
    route: Routes.OrganizationLocations,
    element: (
      <OrganizationRoute>
        <OrganizationLocationsListProvider />
      </OrganizationRoute>
    )
  },
  {
    route: Routes.OrganizationLocationNew,
    element: (
      <OrganizationRoute>
        <OrganizationLocationFormProvider />
      </OrganizationRoute>
    )
  }
];
```

```tsx
// App.tsx — composes domains, never individual features
<CoreDomain />
<AuthDomain />
<RolesDomain />
<OrganizationsDomain />
<UsersDomain />
<LocationsDomain />
```

## Route Separation — Superadmin vs Org User

Superadmin and org-user contexts must be fully separate at the route level. They share views but never guards, shells, or route definitions.

### Route Wrappers

| Wrapper                | Guards                         | Shell                 | Use for                                    |
| ---------------------- | ------------------------------ | --------------------- | ------------------------------------------ |
| `<PlatformAdminRoute>` | AuthGuard → PlatformAdminGuard | PlatformAdminAppShell | `/admin/...` routes                        |
| `<OrganizationRoute>`  | AuthGuard → OrganizationGuard  | AppShell              | `/organization/:organizationId/...` routes |
| `<PublicRoute>`        | None (redirects if authed)     | None                  | `/login`, `/password-reset`, etc.          |

### Dual-Context Features (Route Adapter Pattern)

When the same views serve both superadmin and org-user contexts (e.g., Locations), use a **route adapter** to isolate all route awareness:

```
presentation/{feature}/
├── routeAdapter/
│   ├── abstractions.ts          # LocationsRouteAdapter interface
│   ├── LocationsRouteAdapter.ts # Reads params + navigates per context
│   └── feature.ts
├── LocationsList/               # Shared — no route imports
└── LocationForm/                # Shared — no route imports
```

**The adapter provides:**

- `getOrganizationId()` / `getLocationId()` — reads from current route params
- `navigateToList()` / `navigateToNew()` / `navigateToEdit()` — navigates to correct route set

**Rules:**

- Views NEVER import routes or call `useRoute()` — they are route-agnostic display components
- Presenters delegate all route operations to the adapter
- The adapter reads context from `RouterRepository.getMatchedRoute()`
- Superadmin routes live under `/admin/organizations/:organizationId/...`
- Organization routes live under `/organization/:organizationId/...`
- Same views, same presenters, same adapter — different route wrappers per domain

### Domain Registration

```tsx
// LocationsDomain — org routes
<OrganizationRoute><LocationsListView /></OrganizationRoute>

// OrganizationsDomain — superadmin routes for the same views
<PlatformAdminRoute><LocationsListView /></PlatformAdminRoute>
```

## Component Decomposition

Every visual concern gets its own component file under `components/`. Never inline complex JSX blocks (loaders, empty states, lists, search inputs, table rows) inside a parent component.

**Extract when you see:**

- Ternary chains switching between loader / empty / content
- `.map()` rendering more than a single simple element
- A search input tied to presenter state
- Any repeated visual pattern (table rows, list items, card layouts)

**Structure:**

```
components/
├── {Page}Page.tsx              # Composes sub-components
├── {Feature}List.tsx           # Renders a list of items
├── {Feature}ListEmptyState.tsx # Empty state message
├── {Feature}ListLoader.tsx     # Loading spinner + message
├── {Feature}SearchInput.tsx    # Search input bound to presenter
├── {Feature}Table.tsx          # Table with header + rows
└── {Feature}Row.tsx            # Single table row (or inline in Table file if small)
```

**The parent component reads state and delegates rendering:**

```tsx
const DialogContent = observer(function DialogContent({ vm, onSelect }: Props) {
  if (vm.isLoading) {
    return <ItemListLoader />;
  }

  if (vm.items.length === 0) {
    return <ItemListEmptyState />;
  }

  return <ItemList items={vm.items} onSelect={onSelect} />;
});
```

Each extracted component receives only the data it needs via props — not the full presenter. The parent orchestrates; children render.

## E2E Testing (Playwright)

E2E tests live at `e2e/` (separate workspace). Run with `yarn e2e` (headless), `yarn e2e:headed` (visible browser), or `yarn e2e:ui` (interactive UI). Config: `e2e/playwright.config.ts`. Tests: `e2e/tests/{domain}/{feature}.spec.ts`.

All interactive components must have a `testId` prop for Playwright targeting via `page.getByTestId()`. See the `components` skill for the full `testId` naming convention and supported components.

**Which elements need test IDs:**

| Element                               | Required | How                                                    |
| ------------------------------------- | -------- | ------------------------------------------------------ |
| Action buttons (create, save, delete) | Yes      | `testId` prop on `<Button>`                            |
| Form inputs                           | Yes      | `testId` prop on `<TextInput>`, `<Select>`, etc.       |
| Data tables                           | Yes      | `testId` prop on `<Table>`                             |
| Table rows                            | Yes      | `data-testid` directly on `<Table.Tr>`                 |
| Row action menus                      | Yes      | `testId` prop on `<RowActions>`                        |
| Modals and drawers                    | Yes      | `testId` prop on `<Modal>` / `<Drawer>`                |
| Navigation links                      | Yes      | `testId` prop on `<NavLink>` / `<Anchor>`              |
| Layout containers                     | No       | Only when e2e tests need to assert visibility/presence |
| Display text                          | No       | Only when asserting specific content                   |

**Presenters do NOT generate test IDs.** Test IDs are a view-layer concern — they live in page components only. Presenters remain presentation-framework-agnostic.

**Page-level structural IDs:** Each page component's root element should have `data-testid="{feature}-{context}-page"` (e.g., `data-testid="patients-list-page"`) so e2e tests can assert page navigation.

## Anti-Patterns — NEVER Do These

| Anti-pattern                                      | Correct approach                                        |
| ------------------------------------------------- | ------------------------------------------------------- |
| Component reads from repository directly          | Component reads from `presenter.vm`                     |
| Inline type: `get<{ user: User }>()`              | Named namespace type: `get<Gateway.GetMeResponse>()`    |
| `makeAutoObservable` in repository                | Only in presenter                                       |
| Business logic in component                       | Move to presenter or use case                           |
| Import from `@mantine/core`                       | Import from `~/components/index.js`                     |
| Import from `@tabler/icons-react`                 | Import from `~/icons/index.js`                          |
| Manual `schema.parse()` on API response           | Pass `responseSchema` to HTTPClient options             |
| HTTPClient call without `responseSchema`          | Always pass `responseSchema` — timestamps need coercion |
| Presenter holds raw domain objects in vm          | Presenter maps to view-ready types                      |
| View does `value ?? ""` or null coercion          | Presenter provides correct, view-ready values           |
| useEffect chain for business logic                | Logic in presenter; useEffect only for load-on-mount    |
| Presenter calls gateway/repository                | All reads and writes go through use cases               |
| Component calls gateway/repository                | Component calls presenter methods                       |
| Class method: `async load() {}`                   | Arrow property: `load = async () => {}`                 |
| Hook uses `.bind()`: `p.load.bind(p)`             | Direct reference: `p.load`                              |
| Component calls `useRouter()` to navigate         | Presenter navigates via RouterRepository                |
| Import from `react-router-dom`                    | Use `@webiny/app` router                                |
| View reads route params via `useRoute()`          | Presenter reads via route adapter                       |
| Superadmin route uses `OrganizationRoute` wrapper | Use `PlatformAdminRoute` — separate guard stacks        |
| Presenter imports `Routes` for navigation         | Presenter delegates to route adapter                    |
| Inline ternary chains for loader/empty/list       | Extract each into its own component file                |
| `.map()` with complex JSX in parent component     | Extract list + row components into separate files       |
| `useHasPermission()` hook for conditional render  | Use `<HasPermission feature action>` component          |

## Naming Conventions

| Piece                  | Pattern                       | Example                               |
| ---------------------- | ----------------------------- | ------------------------------------- |
| Gateway abstraction    | `{Feature}Gateway`            | `PlatformAdminGateway`                |
| Repository abstraction | `{Feature}Repository`         | `PlatformAdminRepository`             |
| Presenter abstraction  | `{Page}Presenter`             | `PlatformAdminDashboardPresenter`     |
| ViewModel interface    | `I{Page}ViewModel`            | `IPlatformAdminDashboardViewModel`    |
| Implementation class   | `{Name}Impl` (class only)     | `PlatformAdminDashboardPresenterImpl` |
| Exported const         | Matches abstraction (no Impl) | `PlatformAdminDashboardPresenter`     |
| Provider               | `{Page}Provider`              | `PlatformAdminDashboardProvider`      |
| Page component         | `{Page}Page`                  | `PlatformAdminDashboardPage`          |
| Feature                | `{Name}Feature`               | `PlatformAdminDashboardFeature`       |

## Forms

Form presenters use `FormModelFactory` from `@webiny/app-admin`. See `ai-context/architecture/ui/form-presenters.md` for the full convention.
