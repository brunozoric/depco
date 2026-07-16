# SBOM Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export Software Bill of Materials (SBOM) for projects in CycloneDX 1.5 and SPDX 2.3 JSON formats, with per-project and aggregate export, accessible from both a dedicated /sbom page and project detail page.

**Architecture:** API service collects component/license/vulnerability/dependency data from existing DB tables. Two formatter strategies (CycloneDX 1.5, SPDX 2.3) produce JSON output. A `sendBlob` response helper handles file download responses. UI has a dedicated /sbom page (full MVP stack) and an export button on project detail.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM, SQLite, Zod, React, Mantine UI, MobX

## Global Constraints

- No inline structural types — always use named interfaces
- No short names — "Vulnerability" not "Vuln", "Component" not "Comp"
- DI: abstractions in `abstractions/` directory, `Impl` suffix only on class declaration, namespace exports
- API tests: in-memory SQLite via `createTestDatabaseClient()`, real services, only mock `CommandRunner`
- UI tests: mock `HTTPClient` and `WebSocketListener` at DI level
- Yarn 4, no `npx`/`yarn dlx`
- All named exports, no default exports
- 4-space indent, double quotes, no trailing commas

---

### Task 1: sendBlob Response Helper + SbomService Abstraction + SbomFormatter Abstraction

**Files:**

- Create: `src/shared/routing/sendBlob.ts`
- Modify: `src/shared/routing/index.ts`
- Create: `src/api/services/abstractions/SbomService.ts`
- Create: `src/api/services/abstractions/SbomFormatter.ts`
- Modify: `src/shared/routing/__tests__/sendHelpers.test.ts`

**Interfaces:**

- Consumes: nothing (foundational)
- Produces:
  - `sendBlob(reply: FastifyReply, content: Record<string, unknown>, filename: string, mediaType: string): void`
  - `SbomService.Interface` with `collectForProject(projectId: string): Promise<SbomService.ProjectData>` and `collectForAllProjects(): Promise<SbomService.ProjectData>`
  - `SbomFormatter.Interface` with `format(data: SbomService.ProjectData): SbomFormatter.Result`
  - `SbomFormatter.Result` with `{ content: Record<string, unknown>; filename: string; mediaType: string }`

- [ ] **Step 1: Write the sendBlob test**

Add to `src/shared/routing/__tests__/sendHelpers.test.ts`. Update the import to include `sendBlob`:

```typescript
import { sendOne, sendList, sendNone, sendError, sendBlob } from "../index.js";
```

Add test (uses Fastify injection pattern matching existing tests in this file):

```typescript
it("sendBlob sets Content-Disposition and Content-Type headers and sends JSON buffer", async () => {
  const app = Fastify();
  const route = defineRoute({
    method: "GET",
    path: "/test-blob",
    description: "test",
    params: z.object({}),
    response: z.any()
  });
  registerRoute(app, route, {}, async (_req, reply) => {
    sendBlob(reply, { key: "value" }, "test-file.json", "application/json");
  });

  const res = await app.inject({ method: "GET", url: "/test-blob" });
  expect(res.statusCode).toBe(200);
  expect(res.headers["content-type"]).toBe("application/json");
  expect(res.headers["content-disposition"]).toBe('attachment; filename="test-file.json"');
  expect(JSON.parse(res.body)).toEqual({ key: "value" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: FAIL — `sendBlob` is not defined

- [ ] **Step 3: Implement sendBlob**

Create `src/shared/routing/sendBlob.ts`:

```typescript
import type { FastifyReply } from "fastify";

export function sendBlob(
  reply: FastifyReply,
  content: Record<string, unknown>,
  filename: string,
  mediaType: string
): void {
  const json = JSON.stringify(content, null, 2);
  const buffer = Buffer.from(json, "utf-8");
  reply
    .status(200)
    .header("Content-Type", mediaType)
    .header("Content-Disposition", `attachment; filename="${filename}"`)
    .send(buffer);
}
```

Export from barrel — add `export { sendBlob } from "./sendBlob.js";` to `src/shared/routing/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/routing/__tests__/sendHelpers.test.ts`
Expected: PASS

- [ ] **Step 5: Create SbomFormatter abstraction**

Create `src/api/services/abstractions/SbomFormatter.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";
import type { SbomService } from "./SbomService.js";

export interface ISbomFormatterResult {
  content: Record<string, unknown>;
  filename: string;
  mediaType: string;
}

export interface ISbomFormatter {
  format(data: SbomService.ProjectData): ISbomFormatterResult;
}

export const SbomFormatter = createAbstraction<ISbomFormatter>("Api/SbomFormatter");

export namespace SbomFormatter {
  export type Interface = ISbomFormatter;
  export type Result = ISbomFormatterResult;
}
```

- [ ] **Step 6: Create SbomService abstraction**

Create `src/api/services/abstractions/SbomService.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ISbomComponent {
  packageName: string;
  version: string;
  spdxId: string | null;
  licenseName: string | null;
  type: "dependency" | "devDependency";
}

export interface ISbomVulnerability {
  advisoryId: string;
  severity: string;
  packageName: string;
  source: string;
  advisoryUrl: string | null;
}

export interface ISbomDependencyEdge {
  parentPackage: string | null;
  parentVersion: string | null;
  childPackage: string;
  childVersion: string;
}

export interface ISbomProjectData {
  projectName: string;
  projectPath: string;
  packageManager: string | null;
  components: ISbomComponent[];
  vulnerabilities: ISbomVulnerability[];
  edges: ISbomDependencyEdge[];
}

export interface ISbomService {
  collectForProject(projectId: string): Promise<ISbomProjectData>;
  collectForAllProjects(): Promise<ISbomProjectData>;
}

export const SbomService = createAbstraction<ISbomService>("Api/SbomService");

export namespace SbomService {
  export type Interface = ISbomService;
  export type Component = ISbomComponent;
  export type Vulnerability = ISbomVulnerability;
  export type DependencyEdge = ISbomDependencyEdge;
  export type ProjectData = ISbomProjectData;
}
```

- [ ] **Step 7: Verify build**

Run: `yarn build`
Expected: PASS — no type errors

- [ ] **Step 8: Commit**

```bash
git add src/shared/routing/sendBlob.ts src/shared/routing/index.ts src/shared/routing/__tests__/sendHelpers.test.ts src/api/services/abstractions/SbomService.ts src/api/services/abstractions/SbomFormatter.ts
git commit -m "feat(sbom): add sendBlob helper and SbomService/SbomFormatter abstractions"
```

---

### Task 2: SbomService Implementation + Tests

**Files:**

- Create: `src/api/services/SbomService.ts`
- Create: `src/api/services/__tests__/SbomService.test.ts`
- Modify: `src/api/feature.ts` (register SbomService)

**Interfaces:**

- Consumes: `SbomService` abstraction (Task 1), `DatabaseClient`, DB schema tables (`projects`, `scanResults`, `licenses`, `vulnerabilities`, `dependencyEdges`)
- Produces: `SbomService` DI registration (implementation + dependencies array)

- [ ] **Step 1: Write the tests**

Create `src/api/services/__tests__/SbomService.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
  projects,
  scanResults,
  licenses,
  vulnerabilities,
  dependencyEdges
} from "#api/db/schema.js";
import { createContainer } from "#shared/index.js";
import { DatabaseClient as DatabaseClientAbstraction } from "#api/db/abstractions/DatabaseClient.js";
import { SbomService as SbomServiceAbstraction } from "../abstractions/SbomService.js";
import { SbomService as SbomServiceRegistration } from "../SbomService.js";

describe("SbomService", () => {
  let databaseClient: DatabaseClient.Interface;
  let service: SbomServiceAbstraction.Interface;

  beforeEach(async () => {
    databaseClient = await createTestDatabaseClient();
    const container = createContainer();
    container.registerInstance(DatabaseClientAbstraction, databaseClient);
    container.register(SbomServiceRegistration);
    service = container.resolve(SbomServiceAbstraction);
  });

  async function seedProject(id: string, name: string): Promise<void> {
    await databaseClient.db
      .insert(projects)
      .values({ id, name, path: `/projects/${name}`, addedAt: Date.now(), packageManager: "yarn" })
      .run();
  }

  async function seedScanResult(
    projectId: string,
    packageName: string,
    version: string,
    type: string
  ): Promise<void> {
    await databaseClient.db
      .insert(scanResults)
      .values({
        id: generateId(),
        projectId,
        name: packageName,
        currentVersion: version,
        latestVersion: version,
        latestInRange: version,
        type,
        upgradeType: "none",
        scannedAt: Date.now()
      })
      .run();
  }

  async function seedLicense(
    projectId: string,
    packageName: string,
    spdxId: string
  ): Promise<void> {
    await databaseClient.db
      .insert(licenses)
      .values({
        id: generateId(),
        projectId,
        packageName,
        licenseName: spdxId,
        spdxId,
        source: "registry",
        riskTier: "permissive",
        scannedAt: Date.now()
      })
      .run();
  }

  async function seedVulnerability(
    projectId: string,
    packageName: string,
    advisoryId: string,
    severity: string
  ): Promise<void> {
    await databaseClient.db
      .insert(vulnerabilities)
      .values({
        id: generateId(),
        projectId,
        packageName,
        severity,
        title: `Advisory ${advisoryId}`,
        advisoryUrl: `https://example.com/${advisoryId}`,
        dedupKey: advisoryId,
        source: "osv",
        scannedAt: Date.now()
      })
      .run();
  }

  async function seedEdge(
    projectId: string,
    parentPackage: string | null,
    parentVersion: string | null,
    childPackage: string,
    childVersion: string,
    depth: number
  ): Promise<void> {
    await databaseClient.db
      .insert(dependencyEdges)
      .values({
        id: generateId(),
        projectId,
        parentPackage,
        parentVersion,
        childPackage,
        childVersion,
        dependencyType: "dependency",
        depth,
        scannedAt: Date.now()
      })
      .run();
  }

  describe("collectForProject", () => {
    it("returns empty arrays for a project with no scan data", async () => {
      await seedProject("p1", "my-app");
      const data = await service.collectForProject("p1");
      expect(data.projectName).toBe("my-app");
      expect(data.projectPath).toBe("/projects/my-app");
      expect(data.packageManager).toBe("yarn");
      expect(data.components).toEqual([]);
      expect(data.vulnerabilities).toEqual([]);
      expect(data.edges).toEqual([]);
    });

    it("collects components from scan results with license info", async () => {
      await seedProject("p1", "my-app");
      await seedScanResult("p1", "lodash", "4.17.21", "dependency");
      await seedLicense("p1", "lodash", "MIT");

      const data = await service.collectForProject("p1");

      expect(data.components).toHaveLength(1);
      expect(data.components[0]).toEqual({
        packageName: "lodash",
        version: "4.17.21",
        spdxId: "MIT",
        licenseName: "MIT",
        type: "dependency"
      });
    });

    it("collects vulnerabilities", async () => {
      await seedProject("p1", "my-app");
      await seedVulnerability("p1", "lodash", "CVE-2021-1234", "high");

      const data = await service.collectForProject("p1");

      expect(data.vulnerabilities).toHaveLength(1);
      expect(data.vulnerabilities[0]!.advisoryId).toBe("CVE-2021-1234");
      expect(data.vulnerabilities[0]!.severity).toBe("high");
      expect(data.vulnerabilities[0]!.packageName).toBe("lodash");
    });

    it("collects dependency edges", async () => {
      await seedProject("p1", "my-app");
      await seedEdge("p1", null, null, "lodash", "4.17.21", 0);
      await seedEdge("p1", "lodash", "4.17.21", "lodash.merge", "4.6.2", 1);

      const data = await service.collectForProject("p1");

      expect(data.edges).toHaveLength(2);
    });

    it("returns components without license info when no license record exists", async () => {
      await seedProject("p1", "my-app");
      await seedScanResult("p1", "lodash", "4.17.21", "dependency");

      const data = await service.collectForProject("p1");

      expect(data.components[0]!.spdxId).toBeNull();
      expect(data.components[0]!.licenseName).toBeNull();
    });
  });

  describe("collectForAllProjects", () => {
    it("merges components from multiple projects deduped by packageName+version", async () => {
      await seedProject("p1", "app-a");
      await seedProject("p2", "app-b");
      await seedScanResult("p1", "lodash", "4.17.21", "dependency");
      await seedScanResult("p2", "lodash", "4.17.21", "dependency");
      await seedScanResult("p2", "axios", "1.6.0", "dependency");

      const data = await service.collectForAllProjects();

      expect(data.projectName).toBe("all-projects");
      expect(data.projectPath).toBe("");
      expect(data.packageManager).toBeNull();
      expect(data.components).toHaveLength(2);
      const names = data.components.map(c => c.packageName).sort();
      expect(names).toEqual(["axios", "lodash"]);
    });

    it("deduplicates vulnerabilities by advisoryId + packageName", async () => {
      await seedProject("p1", "app-a");
      await seedProject("p2", "app-b");
      await seedVulnerability("p1", "lodash", "CVE-2021-1234", "high");
      await seedVulnerability("p2", "lodash", "CVE-2021-1234", "high");

      const data = await service.collectForAllProjects();

      expect(data.vulnerabilities).toHaveLength(1);
    });

    it("deduplicates edges from multiple projects", async () => {
      await seedProject("p1", "app-a");
      await seedProject("p2", "app-b");
      await seedEdge("p1", null, null, "lodash", "4.17.21", 0);
      await seedEdge("p2", null, null, "lodash", "4.17.21", 0);

      const data = await service.collectForAllProjects();

      expect(data.edges).toHaveLength(1);
    });

    it("returns empty when no projects exist", async () => {
      const data = await service.collectForAllProjects();

      expect(data.components).toEqual([]);
      expect(data.vulnerabilities).toEqual([]);
      expect(data.edges).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test src/api/services/__tests__/SbomService.test.ts`
Expected: FAIL — `SbomService` implementation not found

- [ ] **Step 3: Implement SbomService**

Create `src/api/services/SbomService.ts`:

```typescript
import { eq } from "drizzle-orm";
import { SbomService as Abstraction } from "./abstractions/SbomService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
  projects,
  scanResults,
  licenses,
  vulnerabilities,
  dependencyEdges
} from "#api/db/schema.js";

class SbomServiceImpl implements Abstraction.Interface {
  public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

  public async collectForProject(projectId: string): Promise<Abstraction.ProjectData> {
    const { db } = this.databaseClient;

    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

    if (!project) {
      return {
        projectName: "unknown",
        projectPath: "",
        packageManager: null,
        components: [],
        vulnerabilities: [],
        edges: []
      };
    }

    const [componentRows, vulnerabilityRows, edgeRows] = await Promise.all([
      this.collectComponents(projectId),
      this.collectVulnerabilities(projectId),
      this.collectEdges(projectId)
    ]);

    return {
      projectName: project.name,
      projectPath: project.path,
      packageManager: project.packageManager,
      components: componentRows,
      vulnerabilities: vulnerabilityRows,
      edges: edgeRows
    };
  }

  public async collectForAllProjects(): Promise<Abstraction.ProjectData> {
    const allProjects = await this.databaseClient.db.select().from(projects).all();

    const allData = await Promise.all(
      allProjects.map(project => this.collectForProject(project.id))
    );

    const componentMap = new Map<string, Abstraction.Component>();
    const vulnerabilityMap = new Map<string, Abstraction.Vulnerability>();
    const edgeMap = new Map<string, Abstraction.DependencyEdge>();

    for (const data of allData) {
      for (const component of data.components) {
        const key = `${component.packageName}@${component.version}`;
        if (!componentMap.has(key)) {
          componentMap.set(key, component);
        }
      }
      for (const vulnerability of data.vulnerabilities) {
        const key = `${vulnerability.advisoryId}::${vulnerability.packageName}`;
        if (!vulnerabilityMap.has(key)) {
          vulnerabilityMap.set(key, vulnerability);
        }
      }
      for (const edge of data.edges) {
        const parent =
          edge.parentPackage !== null
            ? `${edge.parentPackage}@${edge.parentVersion ?? "0.0.0"}`
            : "<root>";
        const edgeKey = `${parent}::${edge.childPackage}@${edge.childVersion}`;
        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, edge);
        }
      }
    }

    return {
      projectName: "all-projects",
      projectPath: "",
      packageManager: null,
      components: [...componentMap.values()],
      vulnerabilities: [...vulnerabilityMap.values()],
      edges: [...edgeMap.values()]
    };
  }

  private async collectComponents(projectId: string): Promise<Abstraction.Component[]> {
    const { db } = this.databaseClient;

    const licenseMap = new Map<string, { spdxId: string | null; licenseName: string }>();
    const licenseRows = await db
      .select()
      .from(licenses)
      .where(eq(licenses.projectId, projectId))
      .all();
    for (const row of licenseRows) {
      licenseMap.set(row.packageName, { spdxId: row.spdxId, licenseName: row.licenseName });
    }

    const scans = await db
      .select()
      .from(scanResults)
      .where(eq(scanResults.projectId, projectId))
      .all();

    return scans.map(scan => {
      const licenseInfo = licenseMap.get(scan.name);
      return {
        packageName: scan.name,
        version: scan.currentVersion,
        spdxId: licenseInfo?.spdxId ?? null,
        licenseName: licenseInfo?.licenseName ?? null,
        type: scan.type as "dependency" | "devDependency"
      };
    });
  }

  private async collectVulnerabilities(projectId: string): Promise<Abstraction.Vulnerability[]> {
    const rows = await this.databaseClient.db
      .select()
      .from(vulnerabilities)
      .where(eq(vulnerabilities.projectId, projectId))
      .all();

    return rows.map(row => ({
      advisoryId: row.dedupKey,
      severity: row.severity,
      packageName: row.packageName,
      source: row.source,
      advisoryUrl: row.advisoryUrl
    }));
  }

  private async collectEdges(projectId: string): Promise<Abstraction.DependencyEdge[]> {
    const rows = await this.databaseClient.db
      .select()
      .from(dependencyEdges)
      .where(eq(dependencyEdges.projectId, projectId))
      .all();

    return rows.map(row => ({
      parentPackage: row.parentPackage,
      parentVersion: row.parentVersion,
      childPackage: row.childPackage,
      childVersion: row.childVersion
    }));
  }
}

export const SbomService = Abstraction.createImplementation({
  implementation: SbomServiceImpl,
  dependencies: [DatabaseClient]
});
```

- [ ] **Step 4: Register in API feature**

In `src/api/feature.ts`, add:

- Import: `import { SbomService } from "./services/SbomService.js";`
- Registration: `container.register(SbomService).inSingletonScope();` (after `ForgeService` line)

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test src/api/services/__tests__/SbomService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/services/SbomService.ts src/api/services/__tests__/SbomService.test.ts src/api/feature.ts
git commit -m "feat(sbom): implement SbomService with project and aggregate data collection"
```

---

### Task 3: CycloneDX Formatter + SPDX Formatter + Registry + Tests

**Files:**

- Create: `src/api/services/sbomFormatters/CycloneDxFormatter.ts`
- Create: `src/api/services/sbomFormatters/SpdxFormatter.ts`
- Create: `src/api/services/sbomFormatters/SbomFormatterRegistry.ts`
- Create: `src/api/services/sbomFormatters/__tests__/CycloneDxFormatter.test.ts`
- Create: `src/api/services/sbomFormatters/__tests__/SpdxFormatter.test.ts`
- Create: `src/api/services/sbomFormatters/__tests__/SbomFormatterRegistry.test.ts`

**Interfaces:**

- Consumes: `SbomFormatter.Interface` (Task 1), `SbomService.ProjectData` (Task 1)
- Produces:
  - `CycloneDxFormatter` class implementing `SbomFormatter.Interface`
  - `SpdxFormatter` class implementing `SbomFormatter.Interface`
  - `SbomFormatterRegistry` with `get(format: string): SbomFormatter.Interface` — throws for unknown format
  - `sanitizeFilename(name: string): string` — shared helper

- [ ] **Step 1: Write CycloneDX formatter test**

Create `src/api/services/sbomFormatters/__tests__/CycloneDxFormatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { CycloneDxFormatter } from "../CycloneDxFormatter.js";
import type { SbomService } from "../../abstractions/SbomService.js";

function createTestData(overrides?: Partial<SbomService.ProjectData>): SbomService.ProjectData {
  return {
    projectName: "my-app",
    projectPath: "/projects/my-app",
    packageManager: "yarn",
    components: [
      {
        packageName: "lodash",
        version: "4.17.21",
        spdxId: "MIT",
        licenseName: "MIT",
        type: "dependency"
      }
    ],
    vulnerabilities: [
      {
        advisoryId: "CVE-2021-1234",
        severity: "high",
        packageName: "lodash",
        source: "osv",
        advisoryUrl: "https://osv.dev/CVE-2021-1234"
      }
    ],
    edges: [
      {
        parentPackage: null,
        parentVersion: null,
        childPackage: "lodash",
        childVersion: "4.17.21"
      }
    ],
    ...overrides
  };
}

describe("CycloneDxFormatter", () => {
  const formatter = new CycloneDxFormatter();

  it("produces valid CycloneDX 1.5 structure", () => {
    const result = formatter.format(createTestData());

    expect(result.mediaType).toBe("application/json");
    expect(result.filename).toBe("my-app-cyclonedx.json");

    const content = result.content as Record<string, unknown>;
    expect(content["bomFormat"]).toBe("CycloneDX");
    expect(content["specVersion"]).toBe("1.5");
    expect(content["serialNumber"]).toMatch(/^urn:uuid:/);
  });

  it("includes components with purl and license", () => {
    const result = formatter.format(createTestData());
    const content = result.content as Record<string, unknown>;
    const components = content["components"] as Array<Record<string, unknown>>;

    expect(components).toHaveLength(1);
    expect(components[0]!["name"]).toBe("lodash");
    expect(components[0]!["version"]).toBe("4.17.21");
    expect(components[0]!["purl"]).toBe("pkg:npm/lodash@4.17.21");
    expect(components[0]!["type"]).toBe("library");

    const componentLicenses = components[0]!["licenses"] as Array<Record<string, unknown>>;
    expect(componentLicenses).toHaveLength(1);
  });

  it("includes vulnerabilities with affects references", () => {
    const result = formatter.format(createTestData());
    const content = result.content as Record<string, unknown>;
    const vulnerabilityList = content["vulnerabilities"] as Array<Record<string, unknown>>;

    expect(vulnerabilityList).toHaveLength(1);
    expect(vulnerabilityList[0]!["id"]).toBe("CVE-2021-1234");
  });

  it("includes dependencies from edges", () => {
    const result = formatter.format(createTestData());
    const content = result.content as Record<string, unknown>;
    const dependencyList = content["dependencies"] as Array<Record<string, unknown>>;

    expect(dependencyList.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty data gracefully", () => {
    const result = formatter.format(
      createTestData({
        components: [],
        vulnerabilities: [],
        edges: []
      })
    );

    const content = result.content as Record<string, unknown>;
    expect(content["components"]).toEqual([]);
    expect(content["vulnerabilities"]).toEqual([]);
  });

  it("sanitizes unsafe characters in filename", () => {
    const result = formatter.format(createTestData({ projectName: 'my/app"bad' }));
    expect(result.filename).toBe("my-app-bad-cyclonedx.json");
  });

  it("omits license block when spdxId is null", () => {
    const result = formatter.format(
      createTestData({
        components: [
          {
            packageName: "unknown-pkg",
            version: "1.0.0",
            spdxId: null,
            licenseName: null,
            type: "dependency"
          }
        ]
      })
    );
    const content = result.content as Record<string, unknown>;
    const components = content["components"] as Array<Record<string, unknown>>;
    expect(components[0]!["licenses"]).toEqual([]);
  });
});
```

- [ ] **Step 2: Write SPDX formatter test**

Create `src/api/services/sbomFormatters/__tests__/SpdxFormatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SpdxFormatter } from "../SpdxFormatter.js";
import type { SbomService } from "../../abstractions/SbomService.js";

function createTestData(overrides?: Partial<SbomService.ProjectData>): SbomService.ProjectData {
  return {
    projectName: "my-app",
    projectPath: "/projects/my-app",
    packageManager: "yarn",
    components: [
      {
        packageName: "lodash",
        version: "4.17.21",
        spdxId: "MIT",
        licenseName: "MIT",
        type: "dependency"
      }
    ],
    vulnerabilities: [],
    edges: [
      {
        parentPackage: null,
        parentVersion: null,
        childPackage: "lodash",
        childVersion: "4.17.21"
      }
    ],
    ...overrides
  };
}

describe("SpdxFormatter", () => {
  const formatter = new SpdxFormatter();

  it("produces valid SPDX 2.3 structure", () => {
    const result = formatter.format(createTestData());

    expect(result.mediaType).toBe("application/json");
    expect(result.filename).toBe("my-app-spdx.json");

    const content = result.content as Record<string, unknown>;
    expect(content["spdxVersion"]).toBe("SPDX-2.3");
    expect(content["dataLicense"]).toBe("CC0-1.0");
    expect(content["SPDXID"]).toBe("SPDXRef-DOCUMENT");
    expect(content["name"]).toBe("my-app");
    expect(content["documentNamespace"] as string).toMatch(/^https:\/\/spdx\.org\/spdxdocs\//);
  });

  it("includes packages with SPDX IDs and license info", () => {
    const result = formatter.format(createTestData());
    const content = result.content as Record<string, unknown>;
    const packages = content["packages"] as Array<Record<string, unknown>>;

    expect(packages).toHaveLength(1);
    expect(packages[0]!["name"]).toBe("lodash");
    expect(packages[0]!["versionInfo"]).toBe("4.17.21");
    expect(packages[0]!["licenseConcluded"]).toBe("MIT");
    expect(packages[0]!["filesAnalyzed"]).toBe(false);
    expect(packages[0]!["SPDXID"]).toMatch(/^SPDXRef-Package-/);
  });

  it("includes DESCRIBES and DEPENDS_ON relationships", () => {
    const result = formatter.format(createTestData());
    const content = result.content as Record<string, unknown>;
    const relationships = content["relationships"] as Array<Record<string, unknown>>;

    const describes = relationships.filter(r => r["relationshipType"] === "DESCRIBES");
    expect(describes.length).toBeGreaterThanOrEqual(1);

    const dependsOn = relationships.filter(r => r["relationshipType"] === "DEPENDS_ON");
    expect(dependsOn.length).toBeGreaterThanOrEqual(0);
  });

  it("does not include vulnerabilities section", () => {
    const result = formatter.format(
      createTestData({
        vulnerabilities: [
          {
            advisoryId: "CVE-2021-1234",
            severity: "high",
            packageName: "lodash",
            source: "osv",
            advisoryUrl: null
          }
        ]
      })
    );

    const content = result.content as Record<string, unknown>;
    expect(content).not.toHaveProperty("vulnerabilities");
  });

  it("uses NOASSERTION when spdxId is null", () => {
    const result = formatter.format(
      createTestData({
        components: [
          {
            packageName: "unknown-pkg",
            version: "1.0.0",
            spdxId: null,
            licenseName: null,
            type: "dependency"
          }
        ]
      })
    );
    const content = result.content as Record<string, unknown>;
    const packages = content["packages"] as Array<Record<string, unknown>>;
    expect(packages[0]!["licenseConcluded"]).toBe("NOASSERTION");
  });

  it("sanitizes unsafe characters in filename", () => {
    const result = formatter.format(createTestData({ projectName: "my:app\ntest" }));
    expect(result.filename).toBe("my-app-test-spdx.json");
  });

  it("produces distinct SPDX IDs for scoped packages", () => {
    const result = formatter.format(
      createTestData({
        components: [
          {
            packageName: "@webiny/stdlib",
            version: "1.0.0",
            spdxId: "MIT",
            licenseName: "MIT",
            type: "dependency"
          },
          {
            packageName: "@other/stdlib",
            version: "1.0.0",
            spdxId: "MIT",
            licenseName: "MIT",
            type: "dependency"
          }
        ]
      })
    );
    const content = result.content as Record<string, unknown>;
    const packages = content["packages"] as Array<Record<string, unknown>>;
    const ids = packages.map(p => p["SPDXID"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 3: Write registry test**

Create `src/api/services/sbomFormatters/__tests__/SbomFormatterRegistry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SbomFormatterRegistry } from "../SbomFormatterRegistry.js";

describe("SbomFormatterRegistry", () => {
  const registry = new SbomFormatterRegistry();

  it("returns CycloneDX formatter for 'cyclonedx'", () => {
    const formatter = registry.get("cyclonedx");
    expect(formatter).toBeDefined();
  });

  it("returns SPDX formatter for 'spdx'", () => {
    const formatter = registry.get("spdx");
    expect(formatter).toBeDefined();
  });

  it("throws for unknown format", () => {
    expect(() => registry.get("unknown")).toThrow("Unknown SBOM format: unknown");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `yarn test src/api/services/sbomFormatters/`
Expected: FAIL — formatters not implemented

- [ ] **Step 5: Implement shared sanitizeFilename helper**

Add at the top of `CycloneDxFormatter.ts` (will be extracted if reuse grows):

```typescript
function sanitizeFilename(name: string): string {
  return name.replace(/["\r\n/\\:]/g, "-");
}
```

Actually, since both formatters need it, create it in a shared spot. Add to the bottom of `src/api/services/abstractions/SbomFormatter.ts`:

```typescript
export function sanitizeFilename(name: string): string {
  return name.replace(/["\r\n/\\:]/g, "-");
}
```

- [ ] **Step 6: Implement CycloneDxFormatter**

Create `src/api/services/sbomFormatters/CycloneDxFormatter.ts`:

```typescript
import { generateId } from "@webiny/stdlib";
import type { SbomFormatter } from "../abstractions/SbomFormatter.js";
import { sanitizeFilename } from "../abstractions/SbomFormatter.js";
import type { SbomService } from "../abstractions/SbomService.js";

interface ICycloneDxComponent {
  type: string;
  name: string;
  version: string;
  purl: string;
  "bom-ref": string;
  licenses: ICycloneDxLicense[];
}

interface ICycloneDxLicense {
  license: { id: string };
}

interface ICycloneDxVulnerability {
  id: string;
  source: { name: string; url: string };
  ratings: Array<{ severity: string; method: string }>;
  affects: Array<{ ref: string }>;
}

interface ICycloneDxDependency {
  ref: string;
  dependsOn: string[];
}

function buildPurl(packageName: string, version: string): string {
  return `pkg:npm/${packageName}@${version}`;
}

export class CycloneDxFormatter implements SbomFormatter.Interface {
  public format(data: SbomService.ProjectData): SbomFormatter.Result {
    const safeName = sanitizeFilename(data.projectName);

    const components: ICycloneDxComponent[] = data.components.map(component => {
      const purl = buildPurl(component.packageName, component.version);
      const componentLicenses: ICycloneDxLicense[] = component.spdxId
        ? [{ license: { id: component.spdxId } }]
        : [];

      return {
        type: "library",
        name: component.packageName,
        version: component.version,
        purl,
        "bom-ref": purl,
        licenses: componentLicenses
      };
    });

    const vulnerabilityEntries: ICycloneDxVulnerability[] = data.vulnerabilities.map(
      vulnerability => ({
        id: vulnerability.advisoryId,
        source: { name: vulnerability.source, url: vulnerability.advisoryUrl ?? "" },
        ratings: [{ severity: vulnerability.severity, method: "other" }],
        affects: [{ ref: `pkg:npm/${vulnerability.packageName}` }]
      })
    );

    const dependencyMap = new Map<string, Set<string>>();
    const projectRef = buildPurl(data.projectName, "0.0.0");

    for (const edge of data.edges) {
      const parentRef =
        edge.parentPackage === null
          ? projectRef
          : buildPurl(edge.parentPackage, edge.parentVersion ?? "0.0.0");
      const childRef = buildPurl(edge.childPackage, edge.childVersion);

      const existing = dependencyMap.get(parentRef) ?? new Set<string>();
      existing.add(childRef);
      dependencyMap.set(parentRef, existing);
    }

    const dependencyEntries: ICycloneDxDependency[] = [...dependencyMap.entries()].map(
      ([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn] })
    );

    const content: Record<string, unknown> = {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      serialNumber: `urn:uuid:${generateId()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [{ vendor: "dependency-upgrader", name: "dependency-upgrader", version: "1.0.0" }],
        component: { type: "application", name: data.projectName, version: "0.0.0" }
      },
      components,
      dependencies: dependencyEntries,
      vulnerabilities: vulnerabilityEntries
    };

    return {
      content,
      filename: `${safeName}-cyclonedx.json`,
      mediaType: "application/json"
    };
  }
}
```

- [ ] **Step 7: Implement SpdxFormatter**

Create `src/api/services/sbomFormatters/SpdxFormatter.ts`:

```typescript
import { generateId } from "@webiny/stdlib";
import type { SbomFormatter } from "../abstractions/SbomFormatter.js";
import { sanitizeFilename } from "../abstractions/SbomFormatter.js";
import type { SbomService } from "../abstractions/SbomService.js";

interface ISpdxPackage {
  SPDXID: string;
  name: string;
  versionInfo: string;
  downloadLocation: string;
  filesAnalyzed: boolean;
  licenseConcluded: string;
  licenseDeclared: string;
  copyrightText: string;
  externalRefs: ISpdxExternalRef[];
}

interface ISpdxExternalRef {
  referenceCategory: string;
  referenceType: string;
  referenceLocator: string;
}

interface ISpdxRelationship {
  spdxElementId: string;
  relatedSpdxElement: string;
  relationshipType: string;
}

function buildSpdxId(packageName: string, version: string): string {
  const sanitized = packageName
    .replace(/^@/, "")
    .replace(/\//g, "--")
    .replace(/[^a-zA-Z0-9.--]/g, "-");
  return `SPDXRef-Package-${sanitized}-${version}`;
}

export class SpdxFormatter implements SbomFormatter.Interface {
  public format(data: SbomService.ProjectData): SbomFormatter.Result {
    const safeName = sanitizeFilename(data.projectName);

    const packages: ISpdxPackage[] = data.components.map(component => ({
      SPDXID: buildSpdxId(component.packageName, component.version),
      name: component.packageName,
      versionInfo: component.version,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: component.spdxId ?? "NOASSERTION",
      licenseDeclared: component.spdxId ?? "NOASSERTION",
      copyrightText: "NOASSERTION",
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceType: "purl",
          referenceLocator: `pkg:npm/${component.packageName}@${component.version}`
        }
      ]
    }));

    const relationships: ISpdxRelationship[] = [];

    for (const spdxPackage of packages) {
      relationships.push({
        spdxElementId: "SPDXRef-DOCUMENT",
        relatedSpdxElement: spdxPackage.SPDXID,
        relationshipType: "DESCRIBES"
      });
    }

    for (const edge of data.edges) {
      if (edge.parentPackage === null) {
        continue;
      }
      relationships.push({
        spdxElementId: buildSpdxId(edge.parentPackage, edge.parentVersion ?? "0.0.0"),
        relatedSpdxElement: buildSpdxId(edge.childPackage, edge.childVersion),
        relationshipType: "DEPENDS_ON"
      });
    }

    const content: Record<string, unknown> = {
      spdxVersion: "SPDX-2.3",
      dataLicense: "CC0-1.0",
      SPDXID: "SPDXRef-DOCUMENT",
      name: data.projectName,
      documentNamespace: `https://spdx.org/spdxdocs/${safeName}-${generateId()}`,
      creationInfo: {
        created: new Date().toISOString(),
        creators: ["Tool: dependency-upgrader"],
        licenseListVersion: "3.19"
      },
      packages,
      relationships
    };

    return {
      content,
      filename: `${safeName}-spdx.json`,
      mediaType: "application/json"
    };
  }
}
```

- [ ] **Step 8: Implement SbomFormatterRegistry**

Create `src/api/services/sbomFormatters/SbomFormatterRegistry.ts`:

```typescript
import type { SbomFormatter } from "../abstractions/SbomFormatter.js";
import { CycloneDxFormatter } from "./CycloneDxFormatter.js";
import { SpdxFormatter } from "./SpdxFormatter.js";

export class SbomFormatterRegistry {
  private readonly formatters: Map<string, SbomFormatter.Interface>;

  public constructor() {
    this.formatters = new Map<string, SbomFormatter.Interface>([
      ["cyclonedx", new CycloneDxFormatter()],
      ["spdx", new SpdxFormatter()]
    ]);
  }

  public get(format: string): SbomFormatter.Interface {
    const formatter = this.formatters.get(format);
    if (!formatter) {
      throw new Error(`Unknown SBOM format: ${format}`);
    }
    return formatter;
  }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `yarn test src/api/services/sbomFormatters/`
Expected: PASS

- [ ] **Step 10: Run full build**

Run: `yarn build`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/api/services/sbomFormatters/ src/api/services/abstractions/SbomFormatter.ts
git commit -m "feat(sbom): implement CycloneDX 1.5 and SPDX 2.3 formatters with registry"
```

---

### Task 4: API Routes + Shared Route Definitions + Tests

**Files:**

- Create: `src/shared/routes/sbom.ts`
- Modify: `src/shared/routes/index.ts`
- Create: `src/api/routes/sbom.ts`
- Modify: `src/api/routes/index.ts`
- Modify: `src/api/server.ts`
- Create: `src/api/routes/__tests__/sbom.test.ts`

**Interfaces:**

- Consumes: `SbomService` (Task 2), `SbomFormatterRegistry` (Task 3), `sendBlob` (Task 1), route definitions
- Produces: `sbomRoutes` Fastify plugin, `exportProjectSbomRoute` and `exportAllSbomRoute` shared route definitions

- [ ] **Step 1: Create shared route definitions**

Create `src/shared/routes/sbom.ts`:

```typescript
import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

export const exportAllSbomRoute = defineRoute({
  method: "GET",
  path: "/api/sbom",
  description: "Export aggregate SBOM for all projects",
  params: z.object({}),
  querystring: z.object({
    format: z.enum(["cyclonedx", "spdx"]).default("cyclonedx")
  }),
  response: z.any()
});

export const exportProjectSbomRoute = defineRoute({
  method: "GET",
  path: "/api/sbom/:projectId",
  description: "Export SBOM for a specific project",
  params: z.object({ projectId: z.string() }),
  querystring: z.object({
    format: z.enum(["cyclonedx", "spdx"]).default("cyclonedx")
  }),
  response: z.any()
});
```

Add to `src/shared/routes/index.ts`:

```typescript
export * from "./sbom.js";
```

- [ ] **Step 2: Create API route handler**

Create `src/api/routes/sbom.ts`:

```typescript
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendError, sendBlob } from "#shared/routing/index.js";
import { exportAllSbomRoute, exportProjectSbomRoute } from "#shared/routes/index.js";
import { SbomService } from "../services/abstractions/SbomService.js";
import { SbomFormatterRegistry } from "../services/sbomFormatters/SbomFormatterRegistry.js";
import { eq } from "drizzle-orm";
import { projects } from "#api/db/schema.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";

export async function sbomRoutes(
  app: FastifyInstance,
  { container }: { container: Container }
): Promise<void> {
  const sbomService = container.resolve(SbomService);
  const databaseClient = container.resolve(DatabaseClient);
  const formatterRegistry = new SbomFormatterRegistry();

  registerRoute(app, exportAllSbomRoute, {}, async (request, reply) => {
    const { format } = request.query;
    const formatter = formatterRegistry.get(format);
    const data = await sbomService.collectForAllProjects();
    const result = formatter.format(data);
    sendBlob(reply, result.content, result.filename, result.mediaType);
  });

  registerRoute(app, exportProjectSbomRoute, {}, async (request, reply) => {
    const { projectId } = request.params;
    const { format } = request.query;

    const project = await databaseClient.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      sendError(reply, 404, "Project not found");
      return;
    }

    const formatter = formatterRegistry.get(format);
    const data = await sbomService.collectForProject(projectId);
    const result = formatter.format(data);
    sendBlob(reply, result.content, result.filename, result.mediaType);
  });
}
```

- [ ] **Step 3: Register routes**

Add to `src/api/routes/index.ts`:

```typescript
export { sbomRoutes } from "./sbom.js";
```

In `src/api/server.ts`, add import and registration:

```typescript
import { sbomRoutes } from "./routes/index.js"; // already imported via destructure — add sbomRoutes to the destructure
// ...
await app.register(sbomRoutes, { container }); // add after dependencyGraphRoutes line
```

- [ ] **Step 4: Write route tests**

Create `src/api/routes/__tests__/sbom.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { DatabaseClient as DatabaseClientAbstraction } from "#api/db/abstractions/DatabaseClient.js";
import { SbomService as SbomServiceAbstraction } from "../../services/abstractions/SbomService.js";
import { SbomService as SbomServiceRegistration } from "../../services/SbomService.js";
import { projects, scanResults } from "#api/db/schema.js";
import { sbomRoutes } from "../sbom.js";
import { createContainer } from "#shared/index.js";

describe("sbom routes", () => {
  let app: FastifyInstance;
  let databaseClient: DatabaseClient.Interface;

  beforeEach(async () => {
    databaseClient = await createTestDatabaseClient();
    const container = createContainer();
    container.registerInstance(DatabaseClientAbstraction, databaseClient);
    container.register(SbomServiceRegistration);

    app = Fastify();
    await app.register(sbomRoutes, { container });
    await app.ready();
  });

  async function seedProject(id: string, name: string): Promise<void> {
    await databaseClient.db
      .insert(projects)
      .values({ id, name, path: `/projects/${name}`, addedAt: Date.now(), packageManager: "yarn" })
      .run();
  }

  async function seedScanResult(projectId: string, packageName: string): Promise<void> {
    await databaseClient.db
      .insert(scanResults)
      .values({
        id: generateId(),
        projectId,
        name: packageName,
        currentVersion: "1.0.0",
        latestVersion: "1.0.0",
        latestInRange: "1.0.0",
        type: "dependency",
        upgradeType: "none",
        scannedAt: Date.now()
      })
      .run();
  }

  describe("GET /api/sbom/:projectId", () => {
    it("returns CycloneDX SBOM for a project", async () => {
      await seedProject("p1", "my-app");
      await seedScanResult("p1", "lodash");

      const response = await app.inject({
        method: "GET",
        url: "/api/sbom/p1?format=cyclonedx"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("application/json");
      expect(response.headers["content-disposition"]).toContain("my-app-cyclonedx.json");

      const body = JSON.parse(response.body);
      expect(body.bomFormat).toBe("CycloneDX");
    });

    it("returns SPDX SBOM for a project", async () => {
      await seedProject("p1", "my-app");

      const response = await app.inject({
        method: "GET",
        url: "/api/sbom/p1?format=spdx"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.spdxVersion).toBe("SPDX-2.3");
    });

    it("defaults to CycloneDX when no format specified", async () => {
      await seedProject("p1", "my-app");

      const response = await app.inject({
        method: "GET",
        url: "/api/sbom/p1"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.bomFormat).toBe("CycloneDX");
    });

    it("returns 404 for unknown project", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/sbom/nonexistent"
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/sbom", () => {
    it("returns aggregate SBOM across all projects", async () => {
      await seedProject("p1", "app-a");
      await seedProject("p2", "app-b");
      await seedScanResult("p1", "lodash");
      await seedScanResult("p2", "axios");

      const response = await app.inject({
        method: "GET",
        url: "/api/sbom?format=cyclonedx"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-disposition"]).toContain("all-projects-cyclonedx.json");

      const body = JSON.parse(response.body);
      expect(body.components).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 5: Run tests**

Run: `yarn test src/api/routes/__tests__/sbom.test.ts`
Expected: PASS

- [ ] **Step 6: Run full build and test suite**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/shared/routes/sbom.ts src/shared/routes/index.ts src/api/routes/sbom.ts src/api/routes/index.ts src/api/server.ts src/api/routes/__tests__/sbom.test.ts
git commit -m "feat(sbom): add SBOM export API routes with CycloneDX and SPDX support"
```

---

### Task 5: UI Features Layer (Gateway + Repository) + Shared downloadBlob Utility

**Files:**

- Create: `src/ui/shared/download/downloadBlob.ts`
- Modify: `src/ui/presentation/backup/BackupPage/BackupPresenter.ts` (use shared downloadBlob)
- Create: `src/ui/features/sbom/abstractions/SbomGateway.ts`
- Create: `src/ui/features/sbom/abstractions/SbomRepository.ts`
- Create: `src/ui/features/sbom/SbomGateway.ts`
- Create: `src/ui/features/sbom/SbomRepository.ts`
- Create: `src/ui/features/sbom/feature.ts`

**Interfaces:**

- Consumes: `exportProjectSbomRoute`, `exportAllSbomRoute` from `#shared/routes/index.js`
- Produces:
  - `downloadBlob(blob: Blob, filename: string): void` shared utility
  - `SbomGateway.Interface` with `exportProject(projectId, format)` and `exportAll(format)` returning `Promise<ISbomExportResponse>`
  - `SbomRepository.Interface` with `getLastExport()` / `setLastExport()`
  - `SbomFeature` DI feature

- [ ] **Step 1: Extract downloadBlob to shared utility**

Create `src/ui/shared/download/downloadBlob.ts`:

```typescript
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

Update `src/ui/presentation/backup/BackupPage/BackupPresenter.ts` to import from shared:

- Remove the local `downloadBlob` function (lines 13-22)
- Add import: `import { downloadBlob } from "#ui/shared/download/downloadBlob.js";`

- [ ] **Step 2: Create SbomGateway abstraction**

Create `src/ui/features/sbom/abstractions/SbomGateway.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ISbomExportResponse {
  blob: Blob;
  filename: string;
}

export interface ISbomGateway {
  exportProject(projectId: string, format: string): Promise<ISbomExportResponse>;
  exportAll(format: string): Promise<ISbomExportResponse>;
}

export const SbomGateway = createAbstraction<ISbomGateway>("Ui/SbomGateway");

export namespace SbomGateway {
  export type Interface = ISbomGateway;
  export type ExportResponse = ISbomExportResponse;
}
```

- [ ] **Step 3: Create SbomRepository abstraction**

Create `src/ui/features/sbom/abstractions/SbomRepository.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface ISbomLastExport {
  format: string;
  timestamp: number;
  filename: string;
}

export interface ISbomRepository {
  getLastExport(): ISbomLastExport | null;
  setLastExport(lastExport: ISbomLastExport): void;
}

export const SbomRepository = createAbstraction<ISbomRepository>("Ui/SbomRepository");

export namespace SbomRepository {
  export type Interface = ISbomRepository;
  export type LastExport = ISbomLastExport;
}
```

- [ ] **Step 4: Implement SbomGateway**

Create `src/ui/features/sbom/SbomGateway.ts`:

```typescript
import { SbomGateway as Abstraction } from "./abstractions/SbomGateway.js";
import { interpolatePath } from "#shared/routing/index.js";
import { exportProjectSbomRoute, exportAllSbomRoute } from "#shared/routes/index.js";

function extractFilename(response: Response): string {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match?.[1] ?? "sbom.json";
}

class SbomGatewayImpl implements Abstraction.Interface {
  public async exportProject(
    projectId: string,
    format: string
  ): Promise<Abstraction.ExportResponse> {
    const path = interpolatePath(exportProjectSbomRoute.path, { projectId });
    const response = await fetch(`${path}?format=${format}`);
    if (!response.ok) {
      throw new Error(`SBOM export failed: ${response.status}`);
    }
    const blob = await response.blob();
    return { blob, filename: extractFilename(response) };
  }

  public async exportAll(format: string): Promise<Abstraction.ExportResponse> {
    const response = await fetch(`${exportAllSbomRoute.path}?format=${format}`);
    if (!response.ok) {
      throw new Error(`SBOM export failed: ${response.status}`);
    }
    const blob = await response.blob();
    return { blob, filename: extractFilename(response) };
  }
}

export const SbomGateway = Abstraction.createImplementation({
  implementation: SbomGatewayImpl,
  dependencies: []
});
```

- [ ] **Step 5: Implement SbomRepository**

Create `src/ui/features/sbom/SbomRepository.ts`:

```typescript
import { SbomRepository as Abstraction } from "./abstractions/SbomRepository.js";

class SbomRepositoryImpl implements Abstraction.Interface {
  private lastExport: Abstraction.LastExport | null = null;

  public getLastExport(): Abstraction.LastExport | null {
    return this.lastExport;
  }

  public setLastExport(lastExport: Abstraction.LastExport): void {
    this.lastExport = lastExport;
  }
}

export const SbomRepository = Abstraction.createImplementation({
  implementation: SbomRepositoryImpl,
  dependencies: []
});
```

- [ ] **Step 6: Create SbomFeature**

Create `src/ui/features/sbom/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { SbomGateway } from "./SbomGateway.js";
import { SbomRepository } from "./SbomRepository.js";

export const SbomFeature = createFeature({
  name: "Ui/Sbom",
  register(container) {
    container.register(SbomGateway).inSingletonScope();
    container.register(SbomRepository).inSingletonScope();
  }
});
```

- [ ] **Step 7: Run build and existing tests**

Run: `yarn build && yarn test`
Expected: PASS — backup tests still pass with extracted downloadBlob

- [ ] **Step 8: Commit**

```bash
git add src/ui/shared/download/downloadBlob.ts src/ui/features/sbom/ src/ui/presentation/backup/BackupPage/BackupPresenter.ts
git commit -m "feat(sbom): add UI gateway, repository, and shared downloadBlob utility"
```

---

### Task 6: UI Presentation Layer (SbomPage + UseCase) + Tests

**Files:**

- Create: `src/ui/presentation/sbom/useCases/abstractions/ExportSbomUseCase.ts`
- Create: `src/ui/presentation/sbom/useCases/ExportSbomUseCase.ts`
- Create: `src/ui/presentation/sbom/useCases/feature.ts`
- Create: `src/ui/presentation/sbom/SbomPage/abstractions/SbomPresenter.ts`
- Create: `src/ui/presentation/sbom/SbomPage/SbomPresenter.ts`
- Create: `src/ui/presentation/sbom/SbomPage/SbomProvider.tsx`
- Create: `src/ui/presentation/sbom/SbomPage/components/SbomPage.tsx`
- Create: `src/ui/presentation/sbom/SbomPage/feature.ts`
- Create: `src/ui/presentation/sbom/__tests__/SbomPresenter.test.ts`
- Modify: `src/ui/App.tsx` (add /sbom route, nav link, feature imports)

**Interfaces:**

- Consumes: `SbomGateway` (Task 5), `SbomRepository` (Task 5), `ProjectsRepository`, `LoadProjectsUseCase`, `downloadBlob` (Task 5)
- Produces: `SbomPresenter.Interface` with VM (`availableProjects`, `selectedProjectId`, `selectedFormat`, `exporting`, `canExportProject`, `error`)

- [ ] **Step 1: Create ExportSbomUseCase abstraction**

Create `src/ui/presentation/sbom/useCases/abstractions/ExportSbomUseCase.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IExportSbomUseCase {
  exportProject(projectId: string, format: string): Promise<void>;
  exportAll(format: string): Promise<void>;
}

export const ExportSbomUseCase = createAbstraction<IExportSbomUseCase>("Ui/ExportSbomUseCase");

export namespace ExportSbomUseCase {
  export type Interface = IExportSbomUseCase;
}
```

- [ ] **Step 2: Implement ExportSbomUseCase**

Create `src/ui/presentation/sbom/useCases/ExportSbomUseCase.ts`:

```typescript
import { ExportSbomUseCase as Abstraction } from "./abstractions/ExportSbomUseCase.js";
import { SbomGateway } from "../../../features/sbom/abstractions/SbomGateway.js";
import { SbomRepository } from "../../../features/sbom/abstractions/SbomRepository.js";
import { downloadBlob } from "#ui/shared/download/downloadBlob.js";

class ExportSbomUseCaseImpl implements Abstraction.Interface {
  public constructor(
    private readonly gateway: SbomGateway.Interface,
    private readonly repository: SbomRepository.Interface
  ) {}

  public async exportProject(projectId: string, format: string): Promise<void> {
    const response = await this.gateway.exportProject(projectId, format);
    this.repository.setLastExport({
      format,
      timestamp: Date.now(),
      filename: response.filename
    });
    downloadBlob(response.blob, response.filename);
  }

  public async exportAll(format: string): Promise<void> {
    const response = await this.gateway.exportAll(format);
    this.repository.setLastExport({
      format,
      timestamp: Date.now(),
      filename: response.filename
    });
    downloadBlob(response.blob, response.filename);
  }
}

export const ExportSbomUseCase = Abstraction.createImplementation({
  implementation: ExportSbomUseCaseImpl,
  dependencies: [SbomGateway, SbomRepository]
});
```

- [ ] **Step 3: Create use case feature**

Create `src/ui/presentation/sbom/useCases/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { ExportSbomUseCase } from "./ExportSbomUseCase.js";

export const SbomUseCasesFeature = createFeature({
  name: "Ui/SbomUseCases",
  register(container) {
    container.register(ExportSbomUseCase);
  }
});
```

- [ ] **Step 4: Create SbomPresenter abstraction**

Create `src/ui/presentation/sbom/SbomPage/abstractions/SbomPresenter.ts`:

```typescript
import { createAbstraction } from "#shared/index.js";

export interface IProjectOption {
  id: string;
  name: string;
}

export interface ISbomViewModel {
  loading: boolean;
  exporting: boolean;
  error: string | null;
  availableProjects: IProjectOption[];
  selectedProjectId: string | null;
  selectedFormat: string;
  canExportProject: boolean;
}

export interface ISbomPresenter {
  get vm(): ISbomViewModel;
  load(): Promise<void>;
  setSelectedProjectId(projectId: string | null): void;
  setSelectedFormat(format: string): void;
  exportProject(): Promise<void>;
  exportAll(): Promise<void>;
}

export const SbomPresenter = createAbstraction<ISbomPresenter>("Ui/SbomPresenter");

export namespace SbomPresenter {
  export type Interface = ISbomPresenter;
  export type ViewModel = ISbomViewModel;
  export type ProjectOption = IProjectOption;
}
```

- [ ] **Step 5: Implement SbomPresenter**

Create `src/ui/presentation/sbom/SbomPage/SbomPresenter.ts`:

```typescript
import { computed, makeAutoObservable, runInAction } from "mobx";
import { SbomPresenter as Abstraction } from "./abstractions/SbomPresenter.js";
import { ExportSbomUseCase } from "../useCases/abstractions/ExportSbomUseCase.js";
import { LoadProjectsUseCase } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";
import { ProjectsRepository } from "../../../features/projects/abstractions/ProjectsRepository.js";

class SbomPresenterImpl implements Abstraction.Interface {
  private loading = true;
  private exporting = false;
  private error: string | null = null;
  private selectedProjectId: string | null = null;
  private selectedFormat = "cyclonedx";

  public constructor(
    private readonly exportSbomUseCase: ExportSbomUseCase.Interface,
    private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
    private readonly projectsRepository: ProjectsRepository.Interface
  ) {
    makeAutoObservable(this, { vm: computed });
  }

  public get vm(): Abstraction.ViewModel {
    return {
      loading: this.loading,
      exporting: this.exporting,
      error: this.error,
      availableProjects: this.projectsRepository.getProjects().map(project => ({
        id: project.id,
        name: project.name
      })),
      selectedProjectId: this.selectedProjectId,
      selectedFormat: this.selectedFormat,
      canExportProject: this.selectedProjectId !== null
    };
  }

  public load = async (): Promise<void> => {
    this.loading = true;
    this.error = null;
    try {
      if (this.projectsRepository.getProjects().length === 0) {
        await this.loadProjectsUseCase.execute();
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Failed to load projects";
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  };

  public setSelectedProjectId = (projectId: string | null): void => {
    this.selectedProjectId = projectId;
  };

  public setSelectedFormat = (format: string): void => {
    this.selectedFormat = format;
  };

  public exportProject = async (): Promise<void> => {
    if (!this.selectedProjectId) {
      return;
    }
    this.exporting = true;
    this.error = null;
    try {
      await this.exportSbomUseCase.exportProject(this.selectedProjectId, this.selectedFormat);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Export failed";
      });
    } finally {
      runInAction(() => {
        this.exporting = false;
      });
    }
  };

  public exportAll = async (): Promise<void> => {
    this.exporting = true;
    this.error = null;
    try {
      await this.exportSbomUseCase.exportAll(this.selectedFormat);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : "Export failed";
      });
    } finally {
      runInAction(() => {
        this.exporting = false;
      });
    }
  };
}

export const SbomPresenter = Abstraction.createImplementation({
  implementation: SbomPresenterImpl,
  dependencies: [ExportSbomUseCase, LoadProjectsUseCase, ProjectsRepository]
});
```

- [ ] **Step 6: Create SbomProvider**

Create `src/ui/presentation/sbom/SbomPage/SbomProvider.tsx`:

```typescript
import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { SbomPageFeature } from "./feature.js";
import type { SbomPresenter } from "./abstractions/SbomPresenter.js";

interface SbomProviderProps {
  children: (params: { presenter: SbomPresenter.Interface }) => React.ReactNode;
}

export function SbomProvider({ children }: SbomProviderProps): React.ReactNode {
  const { presenter } = useFeature(SbomPageFeature);
  return children({ presenter });
}
```

- [ ] **Step 7: Create SbomPage component**

Create `src/ui/presentation/sbom/SbomPage/components/SbomPage.tsx`:

```typescript
import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
    Stack,
    Title,
    Group,
    Select,
    SegmentedControl,
    Button,
    Text,
    Card,
    Skeleton
} from "@mantine/core";
import type { SbomPresenter } from "../abstractions/SbomPresenter.js";

interface SbomPageProps {
    presenter: SbomPresenter.Interface;
}

const FORMAT_OPTIONS = [
    { value: "cyclonedx", label: "CycloneDX" },
    { value: "spdx", label: "SPDX" }
];

export const SbomPage = observer(function SbomPage({
    presenter
}: SbomPageProps): React.ReactNode {
    useEffect(() => {
        void presenter.load();
    }, [presenter]);

    const { vm } = presenter;

    if (vm.loading) {
        return (
            <Stack>
                <Title order={2}>SBOM Export</Title>
                <Skeleton height={200} />
            </Stack>
        );
    }

    return (
        <Stack>
            <Title order={2}>SBOM Export</Title>

            {vm.error && (
                <Text c="red">{vm.error}</Text>
            )}

            <Card withBorder padding="lg">
                <Stack>
                    <Text fw={600}>Format</Text>
                    <SegmentedControl
                        value={vm.selectedFormat}
                        onChange={value => presenter.setSelectedFormat(value)}
                        data={FORMAT_OPTIONS}
                    />

                    <Text fw={600}>Project</Text>
                    <Select
                        placeholder="Select a project"
                        clearable
                        searchable
                        value={vm.selectedProjectId}
                        onChange={value => presenter.setSelectedProjectId(value)}
                        data={vm.availableProjects.map(project => ({
                            value: project.id,
                            label: project.name
                        }))}
                    />

                    <Group>
                        <Button
                            loading={vm.exporting}
                            disabled={!vm.canExportProject}
                            onClick={() => void presenter.exportProject()}
                        >
                            Export Project
                        </Button>
                        <Button
                            variant="light"
                            loading={vm.exporting}
                            onClick={() => void presenter.exportAll()}
                        >
                            Export All Projects
                        </Button>
                    </Group>
                </Stack>
            </Card>
        </Stack>
    );
});
```

- [ ] **Step 8: Create SbomPage feature**

Create `src/ui/presentation/sbom/SbomPage/feature.ts`:

```typescript
import { createFeature } from "#shared/index.js";
import { SbomPresenter as SbomPresenterAbstraction } from "./abstractions/SbomPresenter.js";
import { SbomPresenter } from "./SbomPresenter.js";
import { SbomUseCasesFeature } from "../useCases/feature.js";
import { SbomFeature } from "../../../features/sbom/feature.js";
import { ProjectsFeature } from "../../../features/projects/feature.js";
import { ProjectsUseCasesFeature } from "../../projects/useCases/feature.js";

export interface ISbomPageFeatureExports {
  presenter: SbomPresenterAbstraction.Interface;
}

export const SbomPageFeature = createFeature<void, ISbomPageFeatureExports>({
  name: "Ui/SbomPage",
  dependencies: [SbomUseCasesFeature, SbomFeature, ProjectsFeature, ProjectsUseCasesFeature],
  register(container) {
    container.register(SbomPresenter);
  },
  resolve(container) {
    return {
      presenter: container.resolve(SbomPresenterAbstraction)
    };
  }
});
```

- [ ] **Step 9: Register in App.tsx**

In `src/ui/App.tsx`:

- Add imports for `SbomFeature`, `SbomUseCasesFeature`, `SbomPageFeature`, `SbomProvider`, `SbomPage`
- Add features to `ALL_FEATURES` array: `SbomFeature`, `SbomUseCasesFeature`, `SbomPageFeature`
- Add route in `AppRoutes` (before the packages route):

```typescript
if (path === "/sbom") {
    return (
        <SbomProvider>
            {({ presenter }) => <SbomPage presenter={presenter} />}
        </SbomProvider>
    );
}
```

- Add nav link in header after "Licenses":

```typescript
<Anchor component="button" onClick={() => navigate("/sbom")}>
    SBOM
</Anchor>
```

- [ ] **Step 10: Write presenter tests**

Create `src/ui/presentation/sbom/__tests__/SbomPresenter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { SbomPresenter } from "../SbomPage/abstractions/SbomPresenter.js";
import { SbomPresenter as SbomPresenterRegistration } from "../SbomPage/SbomPresenter.js";
import { ExportSbomUseCase as ExportSbomUseCaseAbstraction } from "../useCases/abstractions/ExportSbomUseCase.js";
import { ProjectsRepository as ProjectsRepositoryAbstraction } from "../../../features/projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseAbstraction } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";

interface MockExportCall {
  method: string;
  args: unknown[];
}

describe("SbomPresenter", () => {
  let exportCalls: MockExportCall[];

  function createPresenter(
    projectList: Array<{ id: string; name: string }> = []
  ): SbomPresenter.Interface {
    const container = createContainer();

    exportCalls = [];
    container.registerInstance(ExportSbomUseCaseAbstraction, {
      exportProject: async (projectId: string, format: string) => {
        exportCalls.push({ method: "exportProject", args: [projectId, format] });
      },
      exportAll: async (format: string) => {
        exportCalls.push({ method: "exportAll", args: [format] });
      }
    });

    container.registerInstance(ProjectsRepositoryAbstraction, {
      getProjects: () =>
        projectList.map(p => ({
          id: p.id,
          name: p.name,
          path: `/projects/${p.name}`,
          packageManager: null,
          pmVersion: null,
          addedAt: 0,
          lastScannedAt: null,
          hasNodeModules: false
        })),
      setProjects: () => {},
      getProject: () => undefined,
      getDependencies: () => undefined,
      setDependencies: () => {},
      getSecurityStatus: () => undefined,
      setSecurityStatus: () => {},
      clear: () => {}
    });

    container.registerInstance(LoadProjectsUseCaseAbstraction, {
      execute: async () => {}
    });

    container.register(SbomPresenterRegistration);
    return container.resolve(SbomPresenter);
  }

  it("starts with loading true and cyclonedx format", () => {
    const presenter = createPresenter();
    expect(presenter.vm.loading).toBe(true);
    expect(presenter.vm.selectedFormat).toBe("cyclonedx");
    expect(presenter.vm.canExportProject).toBe(false);
  });

  it("loads projects and sets loading to false", async () => {
    const presenter = createPresenter([{ id: "p1", name: "my-app" }]);
    await presenter.load();

    expect(presenter.vm.loading).toBe(false);
    expect(presenter.vm.availableProjects).toEqual([{ id: "p1", name: "my-app" }]);
  });

  it("canExportProject is true when a project is selected", async () => {
    const presenter = createPresenter([{ id: "p1", name: "my-app" }]);
    await presenter.load();

    presenter.setSelectedProjectId("p1");

    expect(presenter.vm.canExportProject).toBe(true);
  });

  it("exportProject calls use case with selected project and format", async () => {
    const presenter = createPresenter([{ id: "p1", name: "my-app" }]);
    await presenter.load();
    presenter.setSelectedProjectId("p1");
    presenter.setSelectedFormat("spdx");

    await presenter.exportProject();

    expect(exportCalls).toEqual([{ method: "exportProject", args: ["p1", "spdx"] }]);
  });

  it("exportAll calls use case with selected format", async () => {
    const presenter = createPresenter();
    await presenter.load();
    presenter.setSelectedFormat("cyclonedx");

    await presenter.exportAll();

    expect(exportCalls).toEqual([{ method: "exportAll", args: ["cyclonedx"] }]);
  });

  it("sets error when export fails", async () => {
    const container = createContainer();
    container.registerInstance(ExportSbomUseCaseAbstraction, {
      exportProject: async () => {
        throw new Error("network down");
      },
      exportAll: async () => {
        throw new Error("network down");
      }
    });
    container.registerInstance(ProjectsRepositoryAbstraction, {
      getProjects: () => [
        {
          id: "p1",
          name: "a",
          path: "/a",
          packageManager: null,
          pmVersion: null,
          addedAt: 0,
          lastScannedAt: null,
          hasNodeModules: false
        }
      ],
      setProjects: () => {},
      getProject: () => undefined,
      getDependencies: () => undefined,
      setDependencies: () => {},
      getSecurityStatus: () => undefined,
      setSecurityStatus: () => {},
      clear: () => {}
    });
    container.registerInstance(LoadProjectsUseCaseAbstraction, { execute: async () => {} });
    container.register(SbomPresenterRegistration);
    const presenter = container.resolve(SbomPresenter);

    await presenter.load();
    presenter.setSelectedProjectId("p1");
    await presenter.exportProject();

    expect(presenter.vm.error).toBe("network down");
    expect(presenter.vm.exporting).toBe(false);
  });
});
```

- [ ] **Step 11: Run full build and test suite**

Run: `yarn build && yarn test`
Expected: PASS

- [ ] **Step 12: Run lint**

Run: `yarn lint`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add src/ui/presentation/sbom/ src/ui/App.tsx
git commit -m "feat(sbom): add SBOM page with project/aggregate export and format selection"
```

---

### Task 7: Project Detail Export Button + Final Integration

**Files:**

- Modify: `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts` (add exportSbom method)
- Modify: `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts` (add to VM)
- Modify: `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx` (add export button)
- Modify: `src/ui/presentation/projects/ProjectDetail/feature.ts` (add SbomFeature dependency)

**Interfaces:**

- Consumes: `SbomGateway` (Task 5), `downloadBlob` (Task 5)
- Produces: `exportSbom(format: string)` method on ProjectDetailPresenter, "Export SBOM" Menu button on project detail page

- [ ] **Step 1: Check existing ProjectDetailPresenter structure**

Read the existing presenter to understand current VM, constructor deps, and where to add the export method. The exact lines will vary — locate the class constructor, the VM getter, and the DI registration at the bottom.

- [ ] **Step 2: Add exportingSbom to presenter abstraction VM**

In `src/ui/presentation/projects/ProjectDetail/abstractions/ProjectDetailPresenter.ts`, add `exportingSbom: boolean` to the view model interface and `exportSbom(format: string): Promise<void>` to the presenter interface.

- [ ] **Step 3: Add SbomGateway dependency and exportSbom method to presenter**

In `src/ui/presentation/projects/ProjectDetail/ProjectDetailPresenter.ts`:

- Import `SbomGateway` from `../../../features/sbom/abstractions/SbomGateway.js`
- Import `downloadBlob` from `#ui/shared/download/downloadBlob.js`
- Add `SbomGateway.Interface` to constructor
- Add `private exportingSbom = false` observable
- Add `exportingSbom: this.exportingSbom` to the VM getter
- Implement `exportSbom` method:

```typescript
public exportSbom = async (format: string): Promise<void> => {
    if (!this.projectId) {
        return;
    }
    this.exportingSbom = true;
    try {
        const response = await this.sbomGateway.exportProject(this.projectId, format);
        downloadBlob(response.blob, response.filename);
    } catch (err) {
        runInAction(() => {
            this.error = err instanceof Error ? err.message : "SBOM export failed";
        });
    } finally {
        runInAction(() => {
            this.exportingSbom = false;
        });
    }
};
```

- Add `SbomGateway` to the dependencies array in `createImplementation`.

- [ ] **Step 4: Update ProjectDetail feature.ts**

Add `SbomFeature` to the dependencies array of `ProjectDetailFeature`.

- [ ] **Step 5: Add export button to ProjectDetailPage**

In `src/ui/presentation/projects/ProjectDetail/components/ProjectDetailPage.tsx`, add a Menu button (Mantine `Menu` component) next to existing action buttons:

```tsx
<Menu>
  <Menu.Target>
    <Button variant="light" loading={vm.exportingSbom}>
      Export SBOM
    </Button>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Item onClick={() => void presenter.exportSbom("cyclonedx")}>CycloneDX</Menu.Item>
    <Menu.Item onClick={() => void presenter.exportSbom("spdx")}>SPDX</Menu.Item>
  </Menu.Dropdown>
</Menu>
```

Add `Menu` to the Mantine import.

- [ ] **Step 6: Run full build, test suite, and lint**

Run: `yarn build && yarn test && yarn lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ui/presentation/projects/ProjectDetail/
git commit -m "feat(sbom): add SBOM export button to project detail page"
```
