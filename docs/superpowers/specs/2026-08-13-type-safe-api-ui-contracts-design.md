# Type-Safe API/UI Contracts

Shared route definitions with Zod response schemas, Result-based send helpers, and runtime response validation on UI side. Eliminates discrepancies between what API sends and what UI expects.

## Pattern (from fundus)

Single source of truth: shared response schemas used by both API (sendOne/sendList enforce shape) and UI (httpClient validates response). Route definitions reference response schemas. Use case errors adopt SendableError interface.

## Decisions

1. sendOne/sendList accept Result, handle errors internally
2. Runtime Zod validation on UI side via httpClient.request
3. Response schemas in separate `src/shared/responses/`
4. Flexible envelope — extra top-level keys allowed alongside `{ item }` / `{ items }`
5. Clean break — all call sites updated at once (per domain chunk)
6. Pilot with teams domain, commit. Then roll out rest, commit.
7. sendError adopts SendableError interface (`code`, `message`, `statusCode`, `data?`, `stack?`)
8. getRoutingOptions pattern for stack traces + error logger hook
9. sendNone for void-result endpoints

## Architecture

### SendableError

```typescript
interface SendableError {
  code: string;
  message: string;
  statusCode?: number;
  data?: unknown;
  stack?: string;
}
```

### RoutingOptions

```typescript
interface RoutingOptions {
  showStackTrace: boolean;
  errorLoggerHook?: ErrorLoggerHook.Interface;
}
```

Attached to request object, read by `getRoutingOptions(request)`.

### sendOne

```typescript
function sendOne<TResponse>(params: SendOneParams<TResponse>): FastifyReply;
```

- Accepts `Result<OneResultValue<TResponse>, SendableError>`
- On fail: delegates to sendError with routing options
- On success: iterates result value keys, wraps singles in `{ item }`, arrays in `{ items }`
- TResponse generic = the response shape the route definition declares

### sendList

```typescript
function sendList<TResponse>(
  key: keyof TResponse & string,
  params: SendListParams<TResponse>
): FastifyReply;
```

- Accepts `Result<ListResultValue<TResponse>, SendableError>`
- On fail: delegates to sendError
- On success: wraps as `{ [key]: { items, total } }`

### sendNone

```typescript
function sendNone(params: SendNoneParams): FastifyReply;
```

- Accepts `Result<unknown, SendableError>`
- On fail: delegates to sendError
- On success: 204 or `{ success: true }`

### sendError

```typescript
function sendError(params: SendErrorParams): FastifyReply;
```

- Structured error body: `{ error: { code, message, data?, stack? } }`
- Stack trace only when `routingOptions.showStackTrace === true`
- Error logger hook called when present

### Response schemas

Located in `src/shared/responses/<domain>.ts`. Zod schemas defining exact response shape including envelope wrappers (`{ item }` / `{ items, total }`). Referenced by route definitions via `response` field.

sendOne auto-wraps result value keys: single values become `{ item }`, arrays become `{ items }`. The response schema describes the final wire format after wrapping.

Example (teams):

```typescript
// src/shared/responses/teams.ts
export const listTeamsResponseSchema = z.object({
  items: z.array(teamWithStatsSchema),
  total: z.number()
});

export const createTeamResponseSchema = z.object({
  item: teamWithStatsSchema
});

export const getTeamDetailResponseSchema = z.object({
  item: teamDetailSchema
});
```

### Route handler transformation

Before:

```typescript
result.match({
  ok: data => sendOne({ reply, data }),
  fail: error => sendError({ reply, statusCode: error.statusCode, message: error.message })
});
```

After:

```typescript
return sendOne<CreateTeamResponse>({ reply, request, result, status: 201 });
```

### HTTPClient — no changes needed

HTTPClient already validates responses via `route.response.parse(json)` (line 73 of HTTPClient.ts). Response schemas defined on route definitions flow through automatically. No separate `responseSchema` option needed.

Gateway code stays the same — `httpClient.request(someRoute, { params })` — but now gets runtime Zod validation for free because route definitions have response schemas.

### Use case error update

Add `code` field to all error types:

```typescript
// Before
Result.fail({ statusCode: 404, message: "Team not found" });

// After
Result.fail({ code: "TEAM_NOT_FOUND", statusCode: 404, message: "Team not found" });
```

## Pilot scope: Teams

### New files

- `src/shared/routing/abstractions/SendableError.ts`
- `src/shared/routing/abstractions/RoutingOptions.ts`
- `src/shared/routing/abstractions/ErrorLoggerHook.ts`
- `src/shared/routing/abstractions/index.ts`
- `src/shared/routing/getRoutingOptions.ts`
- `src/shared/responses/teams.ts`

### Modified files

- `src/shared/routing/sendOne.ts` — Result-based, auto-envelope, generic response type
- `src/shared/routing/sendList.ts` — Result-based, key-based wrapping, generic response type
- `src/shared/routing/sendNone.ts` — Result-based, delegates to sendError on fail
- `src/shared/routing/sendError.ts` — SendableError interface, structured error body, routing options
- `src/shared/routing/index.ts` — re-export new abstractions
- `src/shared/routes/teams.ts` — reference response schemas from shared/responses
- `src/api/routes/teams.ts` — simplify handlers to single sendOne/sendList/sendNone calls
- `src/ui/features/Teams/TeamsGateway.ts` — no functional changes needed (validation already works via route.response)
- Teams use case abstractions — add `code` field to error types
- Teams use case implementations — add `code` to Result.fail calls
- Existing send helper tests — update for new signatures
- Teams use case tests — update error assertions for `code` field

### Rollout (after pilot)

Same pattern applied domain by domain: create response schemas, update route definitions, simplify handlers, update gateways. Each domain committed separately.

Domains: auth, users, projects, packages, vulnerabilities, licenses, jobs, settings, engines, install, scan schedules, changelogs, auto-fix, sbom, step-hooks, package-managers.
