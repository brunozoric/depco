# Users Feature — Design Spec

## Overview

Add user management, authentication, and permission enforcement to the dependency manager. All API routes become protected. Users are created by admins (no self-registration). Two permission levels: `"full"` and `"read-only"`. DB-backed sessions with opaque tokens. Two login methods: email+password with email verification code, and magic link. Force-logout capability. CLI `depco init` command for first-user bootstrap.

## Data Model

### `users` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PK | UUID |
| email | text | UNIQUE, NOT NULL | Lowercase, trimmed |
| passwordHash | text | NOT NULL | argon2id |
| displayName | text | NOT NULL | |
| permission | text | NOT NULL | `"full"` or `"read-only"` |
| isActive | integer | NOT NULL, default 1 | Soft delete flag |
| createdAt | integer | NOT NULL | epoch ms |
| updatedAt | integer | NOT NULL | epoch ms |

### `sessions` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PK | UUID |
| userId | text | FK users.id, CASCADE, NOT NULL | |
| tokenHash | text | UNIQUE, NOT NULL | sha256 of raw token |
| expiresAt | integer | NOT NULL | epoch ms, 30 days from creation |
| createdAt | integer | NOT NULL | epoch ms |

### `login_codes` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | text | PK | UUID |
| userId | text | FK users.id, CASCADE, NOT NULL | |
| code | text | NOT NULL | 6-digit code or magic link token |
| type | text | NOT NULL | `"email-code"` or `"magic-link"` |
| expiresAt | integer | NOT NULL | epoch ms, 10 minute TTL |
| usedAt | integer | nullable | Set on use, prevents reuse |
| createdAt | integer | NOT NULL | epoch ms |

## Authentication Flow

### Email + Password + Email Code

1. `POST /api/auth/login` — body: `{ email, password }`. Validates credentials via argon2id. If valid, generates 6-digit code, stores in `login_codes` with type `"email-code"`, sends code via EmailService. Returns `sendNone()` (`{ success: true }`). Returns 401 for invalid credentials, 404 for unknown email, 403 for inactive user.
2. `POST /api/auth/verify-code` — body: `{ email, code }`. Validates code (not expired, not used). Marks code as used. Creates session row. Returns `sendOne()` wrapping `{ token, user }`. Returns 400 for expired/used code, 429 for too many attempts.

### Magic Link

1. `POST /api/auth/magic-link` — body: `{ email }`. Generates one-time token, stores in `login_codes` with type `"magic-link"`. Sends link via EmailService. Returns `sendNone()` (`{ success: true }`). Always returns success even for unknown emails (prevents user enumeration).
2. `POST /api/auth/verify-magic-link` — body: `{ token, email }`. Validates token against email (not expired, not used). Marks as used. Creates session row. Returns `sendOne()` wrapping `{ token, user }`. Returns 400 for expired/used/mismatched token.

### Session Management

- **Get current user:** `GET /api/auth/me` — returns user from session.
- **Logout:** `POST /api/auth/logout` — deletes current session row.
- **Token format:** Raw token generated via `crypto.randomBytes(32).toString("hex")` (cryptographically secure, 256-bit entropy). Stored in DB as sha256 hash. Client sends raw token via `Authorization: Bearer <token>` header.

### Extensibility for OAuth

Auth routes follow a provider strategy pattern. OAuth providers (Google, GitHub, GitLab, etc.) will add:
- `POST /api/auth/:provider/start` — initiates OAuth flow, returns redirect URL
- `GET /api/auth/:provider/callback` — handles OAuth callback, creates session

All auth methods converge at the same point: create session + return token. Provider strategies registered via DI.

### WebSocket Authentication

Current `WebSocketBroadcaster` stores connections as an anonymous `Set<Connection>` with no user association. This needs to change:

**Connection upgrade:** `GET /ws?token=<raw-token>`. The upgrade handler validates the token (same hash+lookup as HTTP routes) before accepting. Invalid/expired tokens reject the upgrade with 401 (close the socket immediately).

**User-aware connection tracking:** `WebSocketBroadcaster` changes from `Set<Connection>` to `Map<Connection, string>` (connection → userId). On accepted upgrade, `addClient(connection, userId)`. Existing `broadcast()` method unchanged (sends to all). New method: `closeConnectionsForUser(userId: string)` — iterates the Map, closes and removes all connections for that userId.

**Force-logout integration:** `POST /api/users/:id/force-logout` deletes all sessions, then calls `broadcaster.closeConnectionsForUser(userId)`.

**Session expiry:** Long-lived WS connections are not proactively closed on session expiry. The periodic session sweep deletes expired rows; the WS connection stays alive until the client disconnects or the server restarts. This is acceptable — WS connections are receive-only (broadcast), so an expired session on a WS connection has no security impact (the user cannot perform any API calls through WS). Force-logout is the mechanism for immediate disconnection.

## Route Protection

### Global Auth Hook

Fastify `onRequest` hook on all `/api/*` routes. Whitelisted (no auth required):
- `POST /api/auth/login`
- `POST /api/auth/verify-code`
- `POST /api/auth/magic-link`
- `POST /api/auth/verify-magic-link`

All other routes require a valid, non-expired session. The hook:
1. Extracts token from `Authorization: Bearer <token>` header
2. Hashes token with sha256
3. Looks up session + user via JOIN (single query)
4. Rejects if session expired, user inactive, or not found
5. Attaches user to `request.user` (id, email, displayName, permission)

### Permission Enforcement

Two permission levels:
- **`"full"`** — unrestricted access to all operations
- **`"read-only"`** — can access all GET routes, logout, and update own profile (displayName, password only — not permission field)

Enforcement via `requirePermission("full")` helper used as Fastify `preHandler` on write routes. Read-only users attempting write operations receive 403.

Routes requiring `"full"` permission:
- All POST/PUT/DELETE on `/api/projects/*` (create, delete, scan, install, upgrade)
- All POST/PUT/DELETE on `/api/settings/*`
- All POST/PUT/DELETE on `/api/users/*` (except own profile update)
- `POST /api/users/:id/force-logout`
- All job-triggering routes
- All scan/upgrade/auto-fix routes

Routes accessible to all authenticated users:
- All GET routes (projects, packages, dashboard, vulnerabilities, licenses, etc.)
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PUT /api/users/:id` (own profile: displayName, password only)

## User CRUD Routes

| Route | Method | Permission | Notes |
|-------|--------|-----------|-------|
| `POST /api/users` | POST | full | Create user (email, displayName, password, permission) |
| `GET /api/users` | GET | any | List users. Query: search, isActive, page, pageSize, sortBy, sortOrder |
| `GET /api/users/:id` | GET | any | Get single user |
| `PUT /api/users/:id` | PUT | own: any, other: full | Own profile: displayName + password. Full users: all fields including permission |
| `DELETE /api/users/:id` | DELETE | full | Soft delete (isActive=0). Deletes all sessions. Cannot delete self |
| `POST /api/users/:id/force-logout` | POST | full | Delete all sessions for target user + close WS connections. Cannot target self (returns 400) |

**User response shape** (never includes passwordHash):
```
{ id, email, displayName, permission, isActive, createdAt, updatedAt }
```

**List response:** `{ items: User[], total }` — consistent with existing app patterns.

**List query params:**
- `search` — matches email or displayName (case-insensitive)
- `isActive` — boolean filter
- `page` / `pageSize` — pagination (default page=1, pageSize=25)
- `sortBy` — `"email"` | `"displayName"` | `"createdAt"` (default `"createdAt"`)
- `sortOrder` — `"asc"` | `"desc"` (default `"desc"`)

## Email Service

### Abstraction

`EmailService` with a single method: `send(params: { to: string; subject: string; text: string; html?: string })`.

### Implementations

1. **ConsoleEmailService** (default) — logs email content to console and AppLogService. Used when no SMTP is configured. Development-friendly.
2. **SmtpEmailService** — real nodemailer SMTP transport. Activated when SMTP config is present.

### Configuration

Config resolution order (highest priority wins):
1. Environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
2. Project config file: `depco.config.ts` in project root
3. Defaults: ConsoleEmailService (no SMTP)

**Config file shape** (`depco.config.ts`):
```ts
export default defineConfig({
    smtp: {
        host: "smtp.example.com",
        port: 587,
        user: "user",
        pass: "secret",
        from: "noreply@example.com"
    }
});
```

The `defineConfig` helper provides type safety. Config file is optional — app works without it. Only `.ts` config files are supported.

**Loading mechanism:** At startup, check for `depco.config.ts` in the project root. Load via dynamic `import()` (requires tsx or ts-node in the runtime, or pre-compiled to JS during build). This is a separate config surface from the existing `.dependency-upgrader.json` (which handles PM settings and step hooks). The JSON config remains for its current scope; `depco.config.ts` handles new infra-level config (SMTP, future OAuth providers, future DB config). The two config files serve different purposes and do not overlap.

### DI Wiring

At startup, check for SMTP config (env vars or config file). If present, register `SmtpEmailService`. Otherwise register `ConsoleEmailService`. Both implement the same `EmailService` abstraction.

### Error Handling

`EmailService.send()` throws on failure. Callers (AuthService) catch and return 500 with "Failed to send verification email" — no internal details leaked. `SmtpEmailService` validates SMTP config at construction time (fails fast at startup if config is incomplete). `ConsoleEmailService` never throws.

## CLI Init Command

### `depco init`

Interactive first-user setup. Separate entry point (`src/cli/init.ts`).

**Flow:**
1. Ensure data directory exists (create if missing)
2. Create DB file if missing, run migrations
3. Check if any users exist in DB. If yes, exit with "Users already exist. Use the app to manage users."
4. Prompt: email (validated as valid email format)
5. Prompt: display name (min 1 character)
6. Prompt: password (min 8 characters, with confirmation)
7. Hash password with argon2id
8. Create user with `permission: "full"`, `isActive: 1`
9. Print success message

**package.json bin entry:**
```json
{
    "bin": {
        "depco": "./dist/cli/index.js"
    }
}
```

`depco init` is the only CLI command for now. CLI uses direct DB access (same DatabaseClient, same schema), no Fastify or DI container.

## UI Changes

### Login Page

Shown when no valid session exists. Two tabs:

**Email + Password tab:**
- Email input, password input, submit button
- On success: shows 6-digit code input field
- Code submission completes login

**Magic Link tab:**
- Email input, submit button
- Shows "Check your email" message after submit
- Magic link opens app with token in URL, auto-verifies via `POST /api/auth/verify-magic-link`

### Auth State in UI

- `AuthGateway` — login, verifyCode, requestMagicLink, verifyMagicLink, logout, getMe
- `AuthRepository` — stores current user + token in memory. Token persisted to localStorage
- `AuthPresenter` — login flow state machine: idle → credentials-submitted → verifying-code → authenticated
- `HTTPClient` updated to include `Authorization: Bearer <token>` header from AuthRepository on all requests. On 401 response, clears token + redirects to login.

### User Management Page

Route: `/users`. Accessible to all authenticated users (write actions gated by permission).

- User list table: email, displayName, permission badge, active status badge, actions column
- Create user button (full only) opens modal: email, displayName, password, permission select
- Edit button per row opens modal: displayName, permission select (full only for permission field)
- Force logout button per row (full only, not on own row)
- Delete button per row (full only, not on own row) with ConfirmDialog

### Navigation Changes

- "Users" link in sidebar (visible to all users)
- User display name + avatar placeholder in header
- Logout dropdown from header user area

## API Layer Structure

Following existing project patterns (services, not use cases on API side):

- `UserService` — DI-wired service handling user CRUD, password hashing, validation. Abstraction in `src/api/services/abstractions/UserService.ts`, implementation in `src/api/services/UserService.ts`.
- `AuthService` — DI-wired service handling login flow, session management, code generation/verification. Abstraction in `src/api/services/abstractions/AuthService.ts`, implementation in `src/api/services/AuthService.ts`.
- `EmailService` — abstraction in `src/api/services/abstractions/EmailService.ts`. Two implementations in separate files: `src/api/services/ConsoleEmailService.ts` (default, logs to console) and `src/api/services/SmtpEmailService.ts` (nodemailer).

All services follow existing project DI patterns: `createAbstraction` for the abstraction, `createImplementation` for the implementation with `dependencies` array, `Impl` suffix only on class declarations (never on exports/imports), namespace with `.Interface` type alias.

### Route files

- `src/api/routes/users.ts` — user CRUD routes
- `src/api/routes/auth.ts` — auth routes (login, verify, magic link, logout, me)

### Shared route definitions

- `src/shared/routes/users.ts` — Zod-validated route definitions for user CRUD
- `src/shared/routes/auth.ts` — Zod-validated route definitions for auth

### Shared types

- `src/shared/users/types.ts` — `UserPermission` type (`"full"` | `"read-only"`), shared user response schema

## Session Cleanup

Expired sessions are cleaned up in two ways:
1. **Lazy cleanup on lookup:** when the auth hook finds an expired session, it deletes that row and rejects the request.
2. **Periodic sweep:** `setInterval` in `server.ts` (every 1 hour) deletes all sessions where `expiresAt < Date.now()`. Same pattern as existing snooze expiry check.

Expired `login_codes` cleaned up by the same periodic sweep (delete where `expiresAt < Date.now()`).

## Error Responses

All auth error responses use `sendError()` with appropriate HTTP status:

| Scenario | Status | Message |
|----------|--------|---------|
| Missing/invalid Authorization header | 401 | "Authentication required" |
| Expired/invalid session | 401 | "Session expired" |
| Inactive user | 403 | "Account is deactivated" |
| Invalid credentials (login) | 401 | "Invalid email or password" |
| Expired login code | 400 | "Code has expired" |
| Already-used login code | 400 | "Code has already been used" |
| Too many code attempts | 429 | "Too many attempts, request a new code" |
| Insufficient permission | 403 | "Insufficient permission" |
| Cannot delete/force-logout self | 400 | "Cannot perform this action on your own account" |
| User not found | 404 | "User not found" |

## Security Considerations

- Passwords hashed with argon2id (already a project dependency)
- Password minimum length: 8 characters (enforced in Zod schema)
- Session tokens: `crypto.randomBytes(32)` (256-bit, cryptographically secure), stored as sha256 hashes
- Login codes expire after 10 minutes, single-use
- Rate limiting on auth routes via `@fastify/rate-limit`:
  - `POST /api/auth/login`: max 10 requests per 15 minutes per IP
  - `POST /api/auth/verify-code`: max 5 requests per 15 minutes per IP (brute-force protection for 6-digit codes)
  - `POST /api/auth/magic-link`: max 5 requests per 15 minutes per IP
  - `POST /api/auth/verify-magic-link`: max 10 requests per 15 minutes per IP
- Email addresses stored lowercase and trimmed
- User response never includes passwordHash
- Inactive users cannot authenticate (checked at session validation)
- Cannot delete or force-logout self (prevents accidental lockout)
- Login endpoint returns generic "Invalid email or password" for both unknown email and wrong password (prevents user enumeration)
- Magic link endpoint always returns success regardless of whether email exists (prevents user enumeration)
- Email service errors during login do not leak internal details — return 500 with "Failed to send verification email"
