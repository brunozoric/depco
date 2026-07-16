# Export Tests, Search Tests, CustomStepResolver DI

**Date**: 2026-08-04
**Scope**: 3 features — vulnerability export dependencyType tests, project search tests, CustomStepResolver DI conversion

## Feature 1: Vulnerability Export Server-Side dependencyType Tests

### Overview

Integration tests verifying the `dependencyType` query param filters vulnerability list and export results correctly at the API layer.

### Test File

`src/api/routes/__tests__/vulnerabilities.test.ts` (add to existing)

### Test Cases

1. `GET /api/vulnerabilities?dependencyType=direct` returns only direct dependencies (packages present in `scan_results`)
2. `GET /api/vulnerabilities?dependencyType=transitive` returns only transitive dependencies (packages NOT in `scan_results`)
3. `GET /api/vulnerabilities` (no dependencyType) returns all
4. `GET /api/vulnerabilities/export?format=json&dependencyType=direct` exports only direct
5. `GET /api/vulnerabilities/export?format=json&dependencyType=transitive` exports only transitive

### Setup

Seed a project with `scan_results` containing some package names. Seed vulnerabilities for both direct (matching scan_results) and transitive (not in scan_results) packages. The `enrichWithProjectNames` function derives `isTransitive` by checking `scan_results`, then `filterByDependencyType` filters the result.

---

## Feature 2: Project Search Tests

### Overview

Unit tests for `ProjectListPresenter.setSearchQuery` filtering behavior.

### Test File

`src/ui/presentation/projects/ProjectList/__tests__/ProjectListPresenter.test.ts` (add to existing)

### Test Cases

1. Default `searchQuery` is empty — `vm.projects` shows all
2. `setSearchQuery("app")` — filters to projects with "app" in name
3. Search matches against path
4. Search matches against package manager
5. Search is case-insensitive
6. Empty search restores all projects
7. Search combines with team filter — both filters apply

---

## Feature 3: Convert CustomStepResolver to DI

### Overview

Convert `CustomStepResolver` from plain class to DI pattern. Last remaining non-DI service in the codebase.

### Changes

| Action | Path                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------- |
| Create | `src/api/services/stepResolvers/abstractions/CustomStepResolver.ts` — abstraction                 |
| Modify | `src/api/services/stepResolvers/CustomStepResolver.ts` — rename to Impl, add createImplementation |
| Modify | `src/api/feature.ts` — register CustomStepResolver                                                |
| Modify | Consumer that does `new CustomStepResolver()` — use DI injection instead                          |

### Pattern

Follow existing step resolver DI pattern (e.g., `SelectPackagesResolver`, `BranchResolver`).

---

## Implementation Order

1. **Feature 1** (export tests) — validates server-side filtering works
2. **Feature 2** (search tests) — validates client-side search
3. **Feature 3** (CustomStepResolver DI) — mechanical conversion
