# Restructure Batch 8: PackageManager + Changelog + Sbom Domains

> **For agentic workers:** These are existing subdirectories being reorganized + absorbing root-level services.

**Goal:** Rename/restructure packageManagers→PackageManager, changelogResolvers→Changelog, sbomFormatters→Sbom. Each absorbs its root-level service.

## Global Constraints

Same as prior batches.

---

### Task 1: PackageManager Domain

**Current state:** `packageManagers/` already has `abstractions/`, `feature.ts`, `index.ts`, drivers, helpers. PackageManagerService sits orphaned in root.

**Actions:**
1. Rename `packageManagers/` → `PackageManager/`
2. Move `abstractions/PackageManagerService.ts` → `PackageManager/abstractions/PackageManagerService.ts`
3. Move `PackageManagerService.ts` → `PackageManager/PackageManagerService.ts`
4. Move `__tests__/PackageManagerService.test.ts` → `PackageManager/__tests__/PackageManagerService.test.ts`
5. Create `PackageManager/drivers/` subfolder, move all 4 driver files there
6. Update `PackageManager/feature.ts` to also register PackageManagerService
7. Update `PackageManager/index.ts` to also export PackageManagerService abstraction

**Rename existing files (drivers into subfolder):**
```bash
mv src/api/services/packageManagers src/api/services/PackageManager
mkdir -p src/api/services/PackageManager/drivers
mv src/api/services/PackageManager/YarnDriver.ts src/api/services/PackageManager/drivers/
mv src/api/services/PackageManager/NpmDriver.ts src/api/services/PackageManager/drivers/
mv src/api/services/PackageManager/PnpmDriver.ts src/api/services/PackageManager/drivers/
mv src/api/services/PackageManager/BunDriver.ts src/api/services/PackageManager/drivers/
```

**Move root service in:**
```bash
mv src/api/services/abstractions/PackageManagerService.ts src/api/services/PackageManager/abstractions/PackageManagerService.ts
mv src/api/services/PackageManagerService.ts src/api/services/PackageManager/PackageManagerService.ts
mv src/api/services/__tests__/PackageManagerService.test.ts src/api/services/PackageManager/__tests__/PackageManagerService.test.ts
```

**Update feature.ts** — add `PackageManagerService` registration to existing `PackageManagerDriverFeature`. Rename feature to `PackageManagerFeature`.

**Update index.ts** — add `PackageManagerService` export.

**Import updates for PackageManagerService abstraction:**
- `src/api/routes/projects.ts:27` — look for PackageManagerService import, update path
- All files importing `PackageManagerService` from `abstractions/PackageManagerService.js` → `PackageManager/index.js`

**Import updates for drivers (internal):** Since drivers moved from `PackageManager/` root to `PackageManager/drivers/`, the `PackageManagerDriverRegistry.ts` import paths to drivers need updating from `./YarnDriver.js` to `./drivers/YarnDriver.js`.

**Import updates for old `packageManagers/` path:** Any external file importing from `./services/packageManagers/...` needs path updated to `./services/PackageManager/...`.

**Commit:** `refactor: restructure PackageManager domain folder`

---

### Task 2: Changelog Domain

**Current state:** `changelogResolvers/` has resolvers + own `abstractions/ChangelogResolver.ts`. ChangelogService sits orphaned in root.

**Actions:**
1. Create `Changelog/` folder
2. Move `abstractions/ChangelogService.ts` → `Changelog/abstractions/ChangelogService.ts`
3. Move `changelogResolvers/abstractions/ChangelogResolver.ts` → `Changelog/abstractions/ChangelogResolver.ts`
4. Move `ChangelogService.ts` → `Changelog/ChangelogService.ts`
5. Create `Changelog/resolvers/` and move 3 resolver files there
6. Move helpers: `extractOwnerRepo.ts`, `parseVersionSections.ts` → `Changelog/`
7. Move tests from both `changelogResolvers/__tests__/` and `__tests__/ChangelogService.test.ts` + `__tests__/compareVersions.test.ts` → `Changelog/__tests__/`
8. Create `feature.ts` + `index.ts`
9. Delete empty `changelogResolvers/` directory

**feature.ts:**
```typescript
import { createFeature } from "#shared/index.js";
import { ChangelogService } from "./ChangelogService.js";
import { GitHubReleasesResolver } from "./resolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "./resolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "./resolvers/NpmReadmeResolver.js";

export const ChangelogFeature = createFeature({
    name: "Api/ChangelogFeature",
    register(container) {
        container.register(GitHubReleasesResolver);
        container.register(ChangelogFileResolver);
        container.register(NpmReadmeResolver);
        container.register(ChangelogService).inSingletonScope();
    }
});
```

**index.ts:**
```typescript
export { ChangelogService } from "./abstractions/ChangelogService.js";
export { ChangelogResolver } from "./abstractions/ChangelogResolver.js";
export { ChangelogFeature } from "./feature.js";
```

**Import updates:** All files importing from `changelogResolvers/` paths need updating to `Changelog/resolvers/`. All imports of ChangelogService abstraction/implementation need updating.

**Commit:** `refactor: restructure Changelog domain folder`

---

### Task 3: Sbom Domain

**Current state:** `sbomFormatters/` has 2 formatters + registry. SbomService and 3 Sbom abstractions sit in root/abstractions.

**Actions:**
1. Create `Sbom/` folder
2. Move `abstractions/SbomService.ts` → `Sbom/abstractions/SbomService.ts`
3. Move `abstractions/SbomFormatter.ts` → `Sbom/abstractions/SbomFormatter.ts`
4. Move `abstractions/SbomFormatterRegistry.ts` → `Sbom/abstractions/SbomFormatterRegistry.ts`
5. Move `SbomService.ts` → `Sbom/SbomService.ts`
6. Create `Sbom/formatters/` and move `CycloneDxFormatter.ts`, `SpdxFormatter.ts` there
7. Move `sbomFormatters/SbomFormatterRegistry.ts` → `Sbom/SbomFormatterRegistry.ts`
8. Move all tests to `Sbom/__tests__/`
9. Create `feature.ts` + `index.ts`
10. Delete empty `sbomFormatters/`

**feature.ts:**
```typescript
import { createFeature } from "#shared/index.js";
import { SbomService } from "./SbomService.js";
import { CycloneDxFormatter } from "./formatters/CycloneDxFormatter.js";
import { SpdxFormatter } from "./formatters/SpdxFormatter.js";
import { SbomFormatterRegistry } from "./SbomFormatterRegistry.js";

export const SbomFeature = createFeature({
    name: "Api/SbomFeature",
    register(container) {
        container.register(CycloneDxFormatter);
        container.register(SpdxFormatter);
        container.register(SbomFormatterRegistry).inSingletonScope();
        container.register(SbomService).inSingletonScope();
    }
});
```

**index.ts:**
```typescript
export { SbomService } from "./abstractions/SbomService.js";
export { SbomFormatterRegistry } from "./abstractions/SbomFormatterRegistry.js";
export { SbomFeature } from "./feature.js";
```

**Commit:** `refactor: restructure Sbom domain folder`
