# Pino Logging Infrastructure

Replace the custom `AppLogService` (DB-only) with pino-based structured logging. Three destinations: console (pretty), file (rotating), DB (SQLite + WebSocket). Fastify HTTP request logging via pino-http.

## Architecture

```
Callers (ErrorReporter, sendError, ConsoleEmailService, etc.)
    |
IAppLogService (existing abstraction - unchanged)
    |
AppLogServiceImpl (rewritten - delegates to pino)
    |
pino instance (singleton, created at startup)
    +-- Console destination (pino-pretty)
    +-- File destination (pino-roll, daily + 10MB cap)
    +-- DB destination (custom writable - appLogs table + WebSocket broadcast)

Fastify server
    +-- pino-http (same pino instance, auto request/response logging)
```

## Components

### LoggerService (new)

Abstraction: `src/api/services/Logger/abstractions/LoggerService.ts`

```typescript
interface ILoggerService {
  logger: pino.Logger;
}
```

Implementation creates the pino instance with all three destinations using `pino.multistream()`. Registered as a singleton in the DI container.

Dependencies: `DatabaseClient`, `WebSocketBroadcaster`, `FileConfigService` (for data directory path and log level).

### Destinations

All in `src/api/services/Logger/destinations/`:

**Console** (`createConsoleDestination.ts`):

- Uses `pino-pretty` for human-readable output
- All levels pass through
- Color output, timestamps, level labels

**File** (`createFileDestination.ts`):

- Uses `pino-roll` for rotation
- Daily rotation + 10MB size cap
- Log files in data directory (same location as SQLite DB)
- JSON format (structured, machine-readable)
- 7-day retention

**Database** (`createDatabaseDestination.ts`):

- Custom Node.js `Writable` stream
- Parses pino JSON log lines
- Maps pino fields to `appLogs` schema:
  - `id`: generated via `generateId()`
  - `level`: pino numeric mapped to string (30=info, 40=warn, 50=error)
  - `source`: from log context `{ source }` field
  - `projectId`: from log context `{ projectId }` field, null if absent
  - `message`: pino `msg` field
  - `details`: from log context `{ details }` field, null if absent
  - `createdAt`: pino `time` field
- Broadcasts `log:created` WebSocket event (same shape as current)
- Filtering: HTTP info-level logs (source: "http") skip DB. HTTP warn+ persists. All app logs persist per configured threshold.

### AppLogService (rewritten)

Same `IAppLogService` interface. Implementation changes from direct DB insert to:

```typescript
public async log(level, source, projectId, message, details?) {
    this.logger[level]({ source, projectId, details }, message);
}
```

Dependencies change: drops `DatabaseClient` + `WebSocketBroadcaster`, adds `LoggerService`.

### Fastify Integration

In `server.ts`, pass pino instance to Fastify:

```typescript
const loggerService = container.resolve(LoggerService);
const app = fastify({ logger: loggerService.logger });
```

Fastify auto-logs request/response with method, url, statusCode, responseTime. These logs get source "http" in context for DB filtering.

## Log Levels

Expand from 3 to 6:

| Level | Pino numeric | Use                                            |
| ----- | ------------ | ---------------------------------------------- |
| trace | 10           | Verbose debugging (disabled by default)        |
| debug | 20           | Development diagnostics                        |
| info  | 30           | Normal operations (scan started, job complete) |
| warn  | 40           | Recoverable issues (retry, deprecation)        |
| error | 50           | Failures (scan failed, DB error)               |
| fatal | 60           | Unrecoverable (startup failure)                |

`LogLevel` type in `AppLogService` abstraction expands to include all 6.

## Log Level Configuration

- Pino instance minimum level: `trace` (let all through to destinations)
- Each destination has its own threshold:
  - Console: configurable, default `info`
  - File: configurable, default `debug`
  - DB: configurable, default `warn` (keeps DB lean)
- HTTP-specific filter: DB destination skips info-level HTTP logs regardless of threshold

Config source: same as current — `appSettings` table `log_level` key or file config `logLevel`. Extended to support per-destination overrides.

## File Structure

```
src/api/services/Logger/
    abstractions/
        LoggerService.ts
    destinations/
        createConsoleDestination.ts
        createFileDestination.ts
        createDatabaseDestination.ts
    LoggerService.ts
    feature.ts
    index.ts
```

Modified files:

- `src/api/services/AppLog/AppLogService.ts` — rewrite implementation
- `src/api/services/AppLog/abstractions/AppLogService.ts` — expand LogLevel
- `src/api/server.ts` — create logger early, pass to Fastify
- `package.json` — add pino, pino-pretty, pino-roll

## Dependencies

- `pino` — core structured logger
- `pino-pretty` — console pretty printer
- `pino-roll` — file rotation (daily + size-based)

## DB Schema

No changes. Existing `appLogs` table schema works as-is.

## UI Impact

None. The UI reads from the same `appLogs` table via the same `ListLogsUseCase` API. WebSocket `log:created` event keeps the same shape. The UI page works unchanged.

## Testing

- **LoggerService unit test**: verify pino instance created with multistream, correct destination count
- **DB destination unit test**: mock DatabaseClient + WebSocketBroadcaster, write a log line, verify DB insert and WS broadcast
- **DB destination filtering test**: HTTP info logs skipped, HTTP error logs persisted, app logs respect threshold
- **AppLogService test**: update existing test — mock LoggerService instead of DatabaseClient
- **ListLogsUseCase / DeleteLogsUseCase tests**: unchanged (same DB, same API)

## Migration

1. Add pino dependencies
2. Create LoggerService + destinations
3. Rewrite AppLogServiceImpl to use LoggerService
4. Wire pino into Fastify server
5. Update AppLogService tests
6. Verify existing logs UI works unchanged
