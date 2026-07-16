---
name: api-architecture
description: Use when building any API feature, use case, repository, or service in api/. Defines the mandatory file structure — abstractions and implementations MUST be in separate files, in separate directories. Invoke BEFORE writing any backend code.
---

# API Architecture — Feature Structure with DI

Everything in the API is a feature. Every service, repository, and use case gets the full abstraction ceremony: abstraction in `abstractions/` subfolder, implementation in a separate file at the feature root.

## The Iron Rule

**Abstractions and implementations are ALWAYS in separate files, in separate directories.**

Never put `createAbstraction()` and `createImplementation()` in the same file. Never.

## Folder Structure

```
api/src/features/{featureName}/
├── abstractions/
│   ├── XxxRepository.ts        # createAbstraction + namespace types
│   ├── XxxUseCase.ts           # createAbstraction + namespace types
│   └── index.ts                # barrel — exports ONLY abstraction tokens
├── useCases/
│   └── {actionName}/
│       ├── abstractions/
│       │   ├── XxxUseCase.ts   # createAbstraction + namespace types
│       │   └── index.ts
│       ├── __tests__/
│       │   └── XxxUseCase.test.ts
│       ├── XxxUseCase.ts       # createImplementation (SEPARATE file)
│       ├── feature.ts          # createFeature
│       └── index.ts
├── routes/
│   ├── index.ts                # registerXxxRoutes(app)
│   └── createXxx.ts            # route handler
├── permissions.ts              # FeatureActionMap augmentation + registerXxxPermissions()
├── feature.ts                  # top-level createFeature bundle
├── errors.ts                   # BaseError subclasses
├── XxxRepository.ts            # createImplementation (SEPARATE file)
└── index.ts                    # barrel exports
```

Cross-cutting concerns that live outside features go in `api/src/core/features/`:

```
api/src/core/features/{Name}/
├── abstractions/
│   ├── Name.ts                 # createAbstraction + namespace types
│   └── index.ts                # barrel
├── Name.ts                     # createImplementation (SEPARATE file)
└── index.ts                    # barrel — exports abstraction only
```

## Abstraction File (in abstractions/)

Interfaces are `export interface` (required for tsgo strict declaration emit). Types re-exported through namespace only.

```ts
// abstractions/PatientRepository.ts
import { createAbstraction } from "shared";

export interface IPatientRecord {
  id: string;
  name: string;
}

export interface IPatientRepository {
  findOne(params: { where: { id: string } }): Promise<IPatientRecord | null>;
}

export const PatientRepository = createAbstraction<IPatientRepository>(
  "Patients/PatientRepository"
);

export namespace PatientRepository {
  export type Interface = IPatientRepository;
  export type Record = IPatientRecord;
}
```

Barrel (`abstractions/index.ts`) exports only the token:

```ts
export { PatientRepository } from "./PatientRepository.js";
```

## Implementation File (at feature root)

The exported const matches the abstraction name. Only the class gets `Impl` suffix. Import alias avoids name clash.

```ts
// PatientRepository.ts (at feature root, NOT in abstractions/)
import { PatientRepository as Abstraction } from "./abstractions/index.js";

class PatientRepositoryImpl implements Abstraction.Interface {
  // ...
}

export const PatientRepository = Abstraction.createImplementation({
  implementation: PatientRepositoryImpl,
  dependencies: [DatabaseClient]
});
```

## Naming Rules

| Thing                            | Name                        | Example                                               |
| -------------------------------- | --------------------------- | ----------------------------------------------------- |
| Abstraction const                | `XxxRepository`             | `PatientRepository`                                   |
| Implementation const             | Same as abstraction         | `PatientRepository`                                   |
| Implementation class             | `XxxImpl` suffix            | `PatientRepositoryImpl`                               |
| File with `createAbstraction`    | `abstractions/Xxx.ts`       | `abstractions/PatientRepository.ts`                   |
| File with `createImplementation` | `Xxx.ts` at feature root    | `PatientRepository.ts`                                |
| Implementation file name         | **NEVER** has `Impl` suffix | `PatientRepository.ts` not `PatientRepositoryImpl.ts` |

## Feature Registration

`register()` is always synchronous. Async work goes in explicit startup functions.

```ts
import { createFeature } from "shared";
import { PatientRepository } from "./PatientRepository.js";

export const PatientsFeature = createFeature({
  name: "Patients/PatientsFeature",
  register(container) {
    container.register(PatientRepository).inSingletonScope();
  }
});
```

## What Lives Where

| Package         | Contains                                                     | Example                                           |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `shared/`       | DTOs, Zod schemas, utilities shared between api and ui       | `createAbstraction`, `Result`, `FeatureActionMap` |
| `api/`          | All backend abstractions, implementations, routes, use cases | `PatientRepository`, `CreatePatientUseCase`       |
| `api/src/core/` | Cross-cutting backend concerns used by multiple features     | `PermissionRegistry`, decorators                  |
| `ui/`           | All frontend abstractions, implementations, presenters       | `RolesGateway`, `RolesListPresenter`              |

**API-only abstractions (repositories, use cases, services) NEVER go in `shared/`.** The UI accesses backend data via HTTP endpoints, not direct imports.

## Key Rules

- Import shared as `"shared"` (not `"shared"`)
- No `@injectable()` decorator — plain classes only
- Consumers import the abstraction; implementations stay inside the feature folder
- The exported const from `createImplementation` must NOT have `Impl` or `Implementation` suffix
- Barrel index.ts exports only the abstraction token
- Use `~/` path alias for api-internal imports (e.g., `~/core/features/PermissionRegistry/index.js`)
