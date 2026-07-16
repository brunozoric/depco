# SBOM Export — Design Spec

## Overview

Export Software Bill of Materials (SBOM) for projects in CycloneDX 1.5 and SPDX 2.3 JSON formats. Supports per-project and aggregate (all projects) export. Includes packages, versions, licenses, dependency relationships, and vulnerabilities (CycloneDX only — SPDX 2.3 spec does not support vulnerability data).

## Data Model

No new DB tables. All data collected from existing tables:

- **packages + versions**: `scanResults` joined with `dependencies`/`dependencyVersions`
- **licenses**: `licenses` table (SPDX ID, risk tier per package)
- **vulnerabilities**: `vulnerabilities` table (advisory ID, severity, package name)
- **dependency tree**: `dependency_edges` table (parent→child with depth)
- **project metadata**: `projects` table (name, path, package manager)

### Collected Data Interfaces

```typescript
interface ISbomComponent {
  packageName: string;
  version: string;
  spdxId: string | null;
  licenseName: string | null;
  type: "dependency" | "devDependency";
}

interface ISbomVulnerability {
  advisoryId: string;
  severity: string;
  packageName: string;
  source: string;
  advisoryUrl: string | null;
}

interface ISbomDependencyEdge {
  parentPackage: string | null;
  parentVersion: string | null;
  childPackage: string;
  childVersion: string;
}

interface ISbomProjectData {
  projectName: string;
  projectPath: string;
  packageManager: string | null;
  components: ISbomComponent[];
  vulnerabilities: ISbomVulnerability[];
  edges: ISbomDependencyEdge[];
}
```

## Service Layer

### SbomService

DI-wired service. Collects data from existing tables via DatabaseClient.

- `collectForProject(projectId: string): Promise<ISbomProjectData>` — queries scanResults + licenses + vulnerabilities + dependency_edges for one project. Returns empty arrays for components/vulnerabilities/edges if project has never been scanned — never throws for missing data.
- `collectForAllProjects(): Promise<ISbomProjectData>` — collects per project, merges: components deduped by `(packageName, version)` tuple, vulnerabilities deduped by `(advisoryId, packageName)` tuple, edges unioned. Aggregate metadata: `projectName = "all-projects"`, `projectPath = ""`, `packageManager = null`.

### Formatters (Strategy Pattern)

**ISbomFormatter interface:**

```typescript
interface ISbomFormatterResult {
  content: Record<string, unknown>;
  filename: string;
  mediaType: string;
}

interface ISbomFormatter {
  format(data: ISbomProjectData): ISbomFormatterResult;
}
```

Formatter returns a plain object. `sendBlob` handles `JSON.stringify` + Buffer conversion — callers never serialize manually.

Formatters sanitize `projectName` before constructing `filename`: replace characters unsafe for HTTP headers and filesystems (`"`, `\r`, `\n`, `/`, `\`, `:`) with `-`. This prevents Content-Disposition header injection.

**CycloneDxFormatter** — CycloneDX 1.5 JSON:

- `bomFormat: "CycloneDX"`, `specVersion: "1.5"`
- `serialNumber: "urn:uuid:..."` (generated per export via `@webiny/stdlib`)
- `metadata.timestamp`, `metadata.tools` (dependency-upgrader), `metadata.component` (the project)
- `components[]`: each package with `type: "library"`, `name`, `version`, `purl` (`pkg:npm/name@version`), `bom-ref`, `licenses[].license.id` (SPDX ID)
- `dependencies[]`: grouped from edges — each parent's `ref` (purl) with `dependsOn[]` (child purls). Root deps use project component as parent.
- `vulnerabilities[]`: `id` (advisory ID), `source.name`, `ratings[].severity`, `affects[].ref` (component purl)
- Filename: `{projectName}-cyclonedx.json` (for aggregate, `projectName` is `"all-projects"`, yielding `all-projects-cyclonedx.json`)

**SpdxFormatter** — SPDX 2.3 JSON:

- `spdxVersion: "SPDX-2.3"`, `dataLicense: "CC0-1.0"`
- `SPDXID: "SPDXRef-DOCUMENT"`, `name: projectName`
- `documentNamespace: "https://spdx.org/spdxdocs/{projectName}-{uuid}"`
- `creationInfo.creators: ["Tool: dependency-upgrader"]`
- `packages[]`: `SPDXID: "SPDXRef-Package-{sanitizedName}-{version}"`, `name`, `versionInfo`, `downloadLocation: "NOASSERTION"`, `filesAnalyzed: false`, `licenseConcluded` (SPDX ID or "NOASSERTION"), `licenseDeclared`, `copyrightText: "NOASSERTION"`, `externalRefs[].referenceLocator` (purl)
- `relationships[]`: mapped from edges as `DEPENDS_ON`. Root project document `DESCRIBES` all top-level packages.
- No vulnerability section (not in SPDX 2.3 spec)
- Filename: `{projectName}-spdx.json` (for aggregate, `projectName` is `"all-projects"`, yielding `all-projects-spdx.json`)

**SbomFormatterRegistry** — maps format string (`"cyclonedx"` | `"spdx"`) to formatter instance. Same pattern as `PackageManagerDriverRegistry`. Created in `JobExecutorRegistry`-style constructor (not individually DI-wired).

No external libraries — both formats are plain JSON construction.

## API Routes

New file: `src/api/routes/sbom.ts`
Route definitions: `src/shared/routes/sbom.ts`

### Response Helper

**`sendBlob(reply, content: Record<string, unknown>, filename: string, mediaType: string)`** — new helper in `src/shared/routing/sendBlob.ts`. Calls `JSON.stringify(content, null, 2)` to produce a formatted string, wraps in a Buffer, sets `Content-Disposition: attachment; filename="..."` and `Content-Type` headers, sends buffer via `reply.send()`. Exported from routing barrel.

### Endpoints

**`GET /api/sbom?format=cyclonedx|spdx`** — aggregate export

- Registered BEFORE `:projectId` route (avoid path shadowing, same pattern as `/api/licenses/summary`)
- `format` query param validated via Zod enum, default `cyclonedx`
- Calls `SbomService.collectForAllProjects()`, formats via registry, returns via `sendBlob` (filename derived from formatter: `all-projects-{format}.json`)

**`GET /api/sbom/:projectId?format=cyclonedx|spdx`** — per-project export

- 404 if project not found
- Calls `SbomService.collectForProject(projectId)`, formats, returns via `sendBlob`

## UI Layer

### A. Project Detail Page — Export Button

Add to existing `ProjectDetailPresenter`:

- `exportSbom(format: string): Promise<void>` method
- `exportingSbom: boolean` observable for loading state
- Calls `SbomGateway.exportProject(projectId, format)`, triggers browser download

React: "Export SBOM" Menu button on project detail page with CycloneDX/SPDX menu items.

### B. Dedicated /sbom Page — Full MVP Stack

New route `/sbom` in navigation.

**Gateway** (`src/ui/features/sbom/`):

```typescript
interface ISbomExportResponse {
  blob: Blob;
  filename: string;
}
```

- `SbomGateway.exportProject(projectId, format): Promise<ISbomExportResponse>`
- `SbomGateway.exportAll(format): Promise<ISbomExportResponse>`

Gateway fetches the endpoint as a raw `fetch()` call (bypassing HTTPClient's JSON parsing), reads `response.blob()`, extracts `filename` from the `Content-Disposition` header. Returns `{ blob, filename }` directly — UseCase passes both to `downloadBlob(blob, filename)` with no re-serialization.

**Repository** (`src/ui/features/sbom/`):

- `SbomRepository` — minimal, holds last export metadata (format, timestamp) for display

**UseCase** (`src/ui/presentation/sbom/useCases/`):

- `ExportSbomUseCase` — calls gateway, triggers browser download via `downloadBlob` helper (same pattern as backup)

**Presenter** (`src/ui/presentation/sbom/SbomPage/`):

- Injects `ProjectsRepository` + `LoadProjectsUseCase` for project list
- Observables: `selectedProjectId`, `selectedFormat`, `exporting`
- VM: `availableProjects`, `selectedProjectId`, `selectedFormat` (`cyclonedx`/`spdx`), `exporting`, `canExportProject` (computed: project selected)

**React** (`SbomPage.tsx`):

- Project Select dropdown (from `availableProjects`)
- Format SegmentedControl (`CycloneDX` / `SPDX`)
- "Export Project" button (disabled when no project selected, loading when exporting)
- "Export All Projects" button (always enabled, loading when exporting)

### Download Mechanism

Reuse existing `downloadBlob` pattern from backup presenter:

```typescript
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

Extract to shared utility in `src/ui/shared/download/` since now used by both backup and SBOM.

## Testing

### API Tests

- **SbomService**: in-memory SQLite, seed scanResults + licenses + vulnerabilities + dependency_edges, verify ISbomProjectData structure. Test aggregate dedup (same package in multiple projects appears once).
- **CycloneDxFormatter**: unit test — pass known ISbomProjectData, assert output has correct `bomFormat`, `specVersion`, `components[].purl`, `vulnerabilities[].id`, `dependencies[].dependsOn`.
- **SpdxFormatter**: unit test — assert SPDX 2.3 compliance (`spdxVersion`, `packages[].SPDXID`, `relationships[].relationshipType`). Confirm no vulnerabilities section.
- **Route tests**: mock SbomService, verify Content-Disposition header + response structure + 404 for missing project.
- **sendBlob**: unit test alongside existing send helper tests.

### UI Tests

- **SbomPresenter**: mock HTTPClient, verify loading states, format selection, export triggers, project selection.
- **ExportSbomUseCase**: mock gateway, verify download triggered.
- Download behavior tested via mock `URL.createObjectURL` (same pattern as backup tests).

## File Structure

```
src/
  api/
    services/
      abstractions/SbomService.ts
      abstractions/SbomFormatter.ts
      SbomService.ts
      sbomFormatters/
        CycloneDxFormatter.ts
        SpdxFormatter.ts
        SbomFormatterRegistry.ts
    routes/sbom.ts
  shared/
    routing/sendBlob.ts
    routes/sbom.ts
  ui/
    features/
      sbom/
        abstractions/SbomGateway.ts
        abstractions/SbomRepository.ts
        SbomGateway.ts
        SbomRepository.ts
        feature.ts
    presentation/
      sbom/
        SbomPage/
          abstractions/SbomPresenter.ts
          SbomPresenter.ts
          SbomProvider.tsx
          components/SbomPage.tsx
          feature.ts
        useCases/
          abstractions/ExportSbomUseCase.ts
          ExportSbomUseCase.ts
          feature.ts
    shared/
      download/downloadBlob.ts
```
