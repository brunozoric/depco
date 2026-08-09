# DI Router Design

## Overview

Extract App.tsx routing into a DI-driven Router system. Each route is an implementation of a Route abstraction with name, path matching, query string validation, and render method. RouteRegistry collects all routes. RouterComponent resolves and renders the matching route.

## Route Abstraction

```
infrastructure/Router/
  abstractions/
    Route.ts              — IRoute + createAbstraction("Ui/Route"), IRouteMatch
    RouteRegistry.ts      — IRouteRegistry + createAbstraction("Ui/RouteRegistry")
    index.ts
  RouteRegistry.ts        — RouteRegistryImpl + createImplementation
  RouterComponent.tsx     — React component, resolves RouteRegistry, renders match
  feature.ts              — RouterFeature
  index.ts
```

### IRouteMatch

```typescript
interface IRouteMatch {
  params: Record<string, string>;
  query: Record<string, unknown>;
}
```

### IRoute

```typescript
interface IRoute {
  name: string;
  path: string | RegExp;
  matchPath(path: string): Record<string, string> | null;
  validateQueryString?(query: URLSearchParams): Record<string, unknown>;
  render(match: IRouteMatch): React.ReactNode;
}

const Route = createAbstraction<IRoute>("Ui/Route");

namespace Route {
  type Interface = IRoute;
  type Match = IRouteMatch;
}
```

- `matchPath` — returns extracted params on match, null on no-match. Simple routes return `{}` on string equality. Parameterized routes extract named groups from regex.
- `validateQueryString` — optional. Parses/validates query params. Returns empty object by default.
- `render` — receives match with params + validated query, returns React element (Provider + Page).

### IRouteRegistry

```typescript
interface IRouteRegistry {
  register(route: Route.Interface): void;
  resolve(args: IRouteResolveArgs): IRouteResolveResult | undefined;
}

interface IRouteResolveArgs {
  path: string;
  query: URLSearchParams;
}

interface IRouteResolveResult {
  route: Route.Interface;
  match: Route.Match;
}
```

RouteRegistryImpl stores routes in insertion order. `resolve` iterates and returns first match. No priority/weight system — order matters (specific routes registered before catch-all).

### RouterComponent

```tsx
function RouterComponent(): React.ReactNode {
  const path = useCurrentPath();
  const container = useContainer();
  const registry = container.resolve(RouteRegistry);
  const query = new URLSearchParams(window.location.search);
  const result = registry.resolve({ path, query });
  if (result) {
    return result.route.render(result.match);
  }
  return null;
}
```

Replaces `AppRoutes` function in App.tsx.

## Route Implementations (19 total)

Each route follows the DI pattern: abstraction + implementation + registered in domain feature.

### File structure per route

```
presentation/<Domain>/<Page>/
  abstractions/
    <Page>Route.ts        — createAbstraction<Route.Interface>("Ui/Route/<Page>")
    index.ts              — existing, add route export
  <Page>Route.tsx         — <Page>RouteImpl + createImplementation
  feature.ts              — existing, add route registration to RouteRegistry
  index.ts                — existing, add route export
```

### Route table

| #   | Name                 | Path                                | Type    | Domain                              | Params          |
| --- | -------------------- | ----------------------------------- | ------- | ----------------------------------- | --------------- |
| 1   | dashboard            | `/`                                 | default | Dashboard/Dashboard                 | none            |
| 2   | project-list         | `/projects`                         | string  | Projects/ProjectList                | none            |
| 3   | project-detail       | `/projects/:projectId`              | regex   | Projects/ProjectDetail              | projectId       |
| 4   | upgrade-wizard       | `/projects/:projectId/upgrade`      | regex   | Projects/UpgradeWizard              | projectId       |
| 5   | step-hooks           | `/projects/:projectId/step-hooks`   | regex   | Projects/StepHooks                  | projectId       |
| 6   | dependency-graph     | `/projects/:projectId/graph`        | regex   | DependencyGraph/GraphPage           | projectId       |
| 7   | job-manager          | `/jobs`                             | string  | Jobs/JobManager                     | none            |
| 8   | pm-settings          | `/settings`                         | string  | Settings/PmSettings                 | none            |
| 9   | app-settings         | `/settings/app`                     | string  | Settings/AppSettings                | none            |
| 10  | log-browser          | `/logs`                             | string  | Logs/LogBrowser                     | none            |
| 11  | backup               | `/backup`                           | string  | Backup/BackupPage                   | none            |
| 12  | vulnerabilities      | `/vulnerabilities`                  | string  | Vulnerabilities/VulnerabilityList   | none            |
| 13  | vulnerability-detail | `/vulnerabilities/:vulnerabilityId` | regex   | Vulnerabilities/VulnerabilityDetail | vulnerabilityId |
| 14  | licenses             | `/licenses`                         | string  | Licenses/LicensesList               | none            |
| 15  | trends               | `/trends`                           | string  | Trends/TrendsPage                   | none            |
| 16  | teams                | `/teams`                            | string  | Teams/TeamsPage                     | none            |
| 17  | team-detail          | `/teams/:teamId`                    | regex   | Teams/TeamDetail                    | teamId          |
| 18  | packages             | `/packages`                         | string  | Packages/PackageList                | none            |
| 19  | users                | `/users`                            | string  | Users/UserList                      | none            |

19 routes total: 12 string paths + 6 regex parameterized paths + 1 dashboard fallback.

### Registration order

RouteRegistry uses first-match-wins. More specific paths must register before less specific ones within the same prefix. Note: simple string routes use exact equality in matchPath (not prefix matching), so `/settings` and `/settings/app` don't conflict in practice. Still, register specific-first as a convention:

- `/projects/:id/upgrade` before `/projects/:id/step-hooks` before `/projects/:id/graph` before `/projects/:id`
- `/vulnerabilities/:id` before `/vulnerabilities`
- `/teams/:id` before `/teams`
- `/settings/app` before `/settings`
- Dashboard registers last (default/fallback — matchPath always returns `{}`)

Each domain's feature.ts handles registration during `register(container)`. The domain compositor's `dependencies` array controls feature registration order.

### Route implementation pattern

**Simple route (string path, no params):**

```typescript
// presentation/Jobs/JobManager/JobManagerRoute.tsx
class JobManagerRouteImpl implements Abstraction.Interface {
    name = "job-manager";
    path = "/jobs";

    matchPath(path: string): Record<string, string> | null {
        return path === this.path ? {} : null;
    }

    render(_match: Route.Match): React.ReactNode {
        return (
            <JobManagerProvider>
                {({ presenter }) => <JobManagerPage presenter={presenter} />}
            </JobManagerProvider>
        );
    }
}
```

**Parameterized route (regex path):**

```typescript
// presentation/Projects/ProjectDetail/ProjectDetailRoute.tsx
class ProjectDetailRouteImpl implements Abstraction.Interface {
    name = "project-detail";
    path = /^\/projects\/([^/]+)$/;

    matchPath(path: string): Record<string, string> | null {
        const match = this.path.exec(path);
        if (!match?.[1]) {
            return null;
        }
        return { projectId: match[1] };
    }

    render(match: Route.Match): React.ReactNode {
        return (
            <ProjectDetailProvider>
                {({ presenter }) => (
                    <ProjectDetailPage presenter={presenter} projectId={match.params["projectId"]!} />
                )}
            </ProjectDetailProvider>
        );
    }
}
```

**Dashboard (default/fallback):**

```typescript
class DashboardRouteImpl implements Abstraction.Interface {
    name = "dashboard";
    path = "/";

    matchPath(_path: string): Record<string, string> | null {
        return {};
    }

    render(_match: Route.Match): React.ReactNode {
        return (
            <DashboardProvider>
                {({ presenter }) => <DashboardPage presenter={presenter} />}
            </DashboardProvider>
        );
    }
}
```

Dashboard's `matchPath` always returns `{}` — it's the catch-all, registered last.

## Domain Feature Registration

Each domain's feature.ts resolves RouteRegistry and registers its routes:

```typescript
// presentation/Jobs/feature.ts (JobsDomainFeature)
register(container) {
    // existing sub-feature registrations stay as dependencies
    const registry = container.resolve(RouteRegistry);
    registry.register(container.resolve(JobManagerRoute));
}
```

Domain features add `RouterFeature` as a dependency (needed to resolve RouteRegistry).

## App.tsx Changes

- Remove all 19 route-related imports (Provider + Page per route)
- Remove 6 path pattern constants
- Remove `AppRoutes` function (180 lines)
- Add `RouterComponent` import from infrastructure/Router
- Render `<RouterComponent />` where `<AppRoutes />` was

App.tsx shrinks by ~200 lines.

## Existing Router Infrastructure

`src/ui/infrastructure/Shared/router/router.ts` stays unchanged — it provides `navigate()` and `useCurrentPath()` for browser history management. The new Router infrastructure handles route resolution only.

## Testing

- RouteRegistry tests: register + resolve, order matters, no match returns undefined
- Each route implementation: matchPath returns correct params or null
- RouterComponent: mock registry, verify render called with correct match
- `yarn full` must pass after each change

## Login Route

Login page (`/login`) is handled outside the router — it renders before the authenticated shell. No route abstraction needed for it.

## Files Summary

- **Create:** infrastructure/Router/ (6 files: 2 abstractions, impl, component, feature, index)
- **Create:** 19 route abstractions + implementations (2-3 files per route in existing domain folders)
- **Modify:** 19 domain feature.ts files (add route registration)
- **Modify:** App.tsx (remove AppRoutes, render RouterComponent)
- **Modify:** AGENTS.md (document Router infrastructure)
