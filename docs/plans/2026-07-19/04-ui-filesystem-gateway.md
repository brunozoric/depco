# UI Filesystem Gateway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI-side gateway + feature for calling the filesystem browse API. Provides `FilesystemGateway.browse(path)` to presenters.

**Architecture:** Standard Gateway abstraction + implementation following DI conventions. Uses `HTTPClient.request()` with the shared `browseFilesystemRoute` definition.

**Tech Stack:** `@webiny/di`, `HTTPClient` abstraction, Zod route definitions

## Global Constraints

- DI conventions: abstraction in `abstractions/` dir, implementation separate, namespace with `Interface`
- Gateway uses `HTTPClient.request(routeDef, args)` — never raw fetch
- Build before test: `yarn build`

## Dependencies on Prior Plans

- Plan 01 (filesystem browse API) must be completed first

---

### Task 1: FilesystemGateway Abstraction + Implementation + Feature

**Files:**

- Create: `src/ui/features/filesystem/abstractions/FilesystemGateway.ts`
- Create: `src/ui/features/filesystem/abstractions/index.ts`
- Create: `src/ui/features/filesystem/FilesystemGateway.ts`
- Create: `src/ui/features/filesystem/feature.ts`

**Interfaces:**

- Consumes: `HTTPClient.Interface` from `ui/httpClient/abstractions/HTTPClient.js`, `browseFilesystemRoute` from `#shared/routes/index.js`
- Produces: `FilesystemGateway.Interface` with `browse(path?, showHidden?): Promise<BrowseItem[]>`

- [ ] **Step 1: Write the abstraction**

```typescript
// src/ui/features/filesystem/abstractions/FilesystemGateway.ts
import { createAbstraction } from "#shared/index.js";

export interface IBrowseItem {
  name: string;
  path: string;
}

export interface IFilesystemGateway {
  browse(path?: string, showHidden?: boolean): Promise<IBrowseItem[]>;
}

export const FilesystemGateway = createAbstraction<IFilesystemGateway>("Ui/FilesystemGateway");

export namespace FilesystemGateway {
  export type Interface = IFilesystemGateway;
  export type BrowseItem = IBrowseItem;
}
```

```typescript
// src/ui/features/filesystem/abstractions/index.ts
export { FilesystemGateway } from "./FilesystemGateway.js";
```

- [ ] **Step 2: Write the implementation**

```typescript
// src/ui/features/filesystem/FilesystemGateway.ts
import { FilesystemGateway as Abstraction } from "./abstractions/FilesystemGateway.js";
import { HTTPClient } from "../../httpClient/abstractions/HTTPClient.js";
import { browseFilesystemRoute } from "#shared/routes/index.js";

class FilesystemGatewayImpl implements Abstraction.Interface {
  public constructor(private readonly httpClient: HTTPClient.Interface) {}

  public async browse(path?: string, showHidden?: boolean): Promise<Abstraction.BrowseItem[]> {
    const querystring: Record<string, string> = {};
    if (path) {
      querystring.path = path;
    }
    if (showHidden) {
      querystring.showHidden = "true";
    }

    const response = await this.httpClient.request<{
      items: Abstraction.BrowseItem[];
    }>(browseFilesystemRoute, { querystring });

    return response.items;
  }
}

export const FilesystemGateway = Abstraction.createImplementation({
  implementation: FilesystemGatewayImpl,
  dependencies: [HTTPClient]
});
```

- [ ] **Step 3: Write the feature**

```typescript
// src/ui/features/filesystem/feature.ts
import type { Container } from "@webiny/di";
import { createFeature } from "#shared/index.js";
import { FilesystemGateway } from "./FilesystemGateway.js";

export const FilesystemFeature = createFeature({
  name: "Ui/FilesystemFeature",
  register(container: Container) {
    container.register(FilesystemGateway).inSingletonScope();
  }
});
```

- [ ] **Step 4: Register in app**

Find where other UI features are registered (likely `src/ui/App.tsx` or a root feature file) and add `FilesystemFeature.register(container)`.

- [ ] **Step 5: Build and run full test suite**

Run: `yarn build && yarn test`
Expected: All existing tests pass, no import errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/features/filesystem/
git commit -m "feat: FilesystemGateway — UI gateway for filesystem browse API"
```
