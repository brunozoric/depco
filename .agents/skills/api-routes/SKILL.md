---
name: api-routes
description: Use when building UI screens, writing integration tests, designing specs, or any task that needs to know the backend API surface. Loads the complete route catalog grouped by feature.
---

# API Route Catalog

Complete backend route surface — 236 endpoints across 29 features.

**Response envelope:** `{ data }` on success, `{ error: { code, message, data?, stack? } }` on failure.
**Auth patterns:** `requireAuth` = session cookie, `requirePlatformAdmin` = isPlatformAdmin flag.
**Scoping:** `/organization/:orgId/*` (org-level), `/organization/:orgId/location/:locationId/*` (location-level).

## Auth (21 routes)

| Method    | Path                                                         | Auth                 | Description                                           |
| --------- | ------------------------------------------------------------ | -------------------- | ----------------------------------------------------- |
| POST      | /auth/login                                                  | None                 | Login with email/password, sets session cookie        |
| POST      | /auth/logout                                                 | requireAuth          | Clear session                                         |
| GET       | /auth/me                                                     | requireAuth          | Current user + memberships + roles + permissions      |
| POST      | /auth/invite/:token                                          | None                 | Accept invitation, set initial password               |
| POST      | /auth/password-reset                                         | None                 | Request password reset email                          |
| POST      | /auth/password-reset/:token                                  | None                 | Complete password reset                               |
| GET       | /auth/oauth/:provider/login                                  | None                 | Redirect to OAuth provider                            |
| GET\|POST | /auth/oauth/:provider/login/callback                         | None                 | OAuth login callback                                  |
| GET       | /auth/oauth/:provider/connect                                | requireAuth          | Link existing account to OAuth                        |
| GET\|POST | /auth/oauth/:provider/connect/callback                       | requireAuth          | OAuth connect callback                                |
| DELETE    | /auth/oauth/:provider/connect                                | requireAuth          | Unlink OAuth provider                                 |
| POST      | /platform/users/:userId/impersonate                          | requirePlatformAdmin | Create impersonation token                            |
| POST      | /session/exit-impersonation                                  | requireAuth          | Exit impersonation                                    |
| GET       | /organization/:orgId/location/:locationId/users              | requireAuth          | List users                                            |
| POST      | /organization/:orgId/location/:locationId/users              | requireAuth          | Create user (sends invite)                            |
| GET       | /organization/:orgId/location/:locationId/users/:id          | requireAuth          | Get user                                              |
| PATCH     | /organization/:orgId/location/:locationId/users/:id          | requireAuth          | Update user                                           |
| DELETE    | /organization/:orgId/location/:locationId/users/:id          | requireAuth          | Deactivate user                                       |
| POST      | /organization/:orgId/location/:locationId/users/:id/password | requireAuth          | Change password                                       |
| POST      | /organization/:orgId/location/:locationId/users/:id/invite   | requireAuth          | Resend invite                                         |
| POST      | /auth/magic-link                                             | None                 | Request magic link: { email } → always { sent: true } |
| GET       | /auth/magic-link/:token                                      | None                 | Validate magic link, create session, redirect to UI   |
| GET       | /auth/oauth/providers                                        | None                 | List enabled OAuth providers (for login page)         |

## Platform Admin — OAuth Providers (4 routes)

| Method | Path                                | Auth                 | Description                                                            |
| ------ | ----------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| GET    | /platform/oauth-providers           | requirePlatformAdmin | List all registered providers with status                              |
| GET    | /platform/oauth-providers/:provider | requirePlatformAdmin | Get provider settings (credentials masked)                             |
| PUT    | /platform/oauth-providers/:provider | requirePlatformAdmin | Upsert provider credentials (**KEEP_EXISTING** sentinel for unchanged) |
| DELETE | /platform/oauth-providers/:provider | requirePlatformAdmin | Delete provider settings                                               |

## Locations (6 routes)

| Method | Path                                                    | Auth        | Description                                                                              |
| ------ | ------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| GET    | /organization/:orgId/locations                          | requireAuth | List org locations                                                                       |
| POST   | /organization/:orgId/locations                          | requireAuth | Create location                                                                          |
| GET    | /organization/:orgId/locations/:locationId              | requireAuth | Get location                                                                             |
| PATCH  | /organization/:orgId/locations/:locationId              | requireAuth | Update location (partial)                                                                |
| DELETE | /organization/:orgId/locations/:locationId              | requireAuth | Delete location                                                                          |
| PUT    | /organization/:orgId/location/:locationId/working-hours | requireAuth | Set all 7 days at once; body: `{ hours: [{ dayOfWeek: 0-6, slots: [{ start, end }] }] }` |

## Organizations (13 routes)

| Method | Path                                      | Auth                 | Description                                                                                            |
| ------ | ----------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| POST   | /organizations                            | requirePlatformAdmin | Create organization                                                                                    |
| GET    | /organizations                            | requirePlatformAdmin | List all orgs (search/filter/sort/pagination)                                                          |
| GET    | /organization/:orgId                      | requireAuth          | Get organization                                                                                       |
| PATCH  | /organization/:orgId                      | requireAuth          | Update organization                                                                                    |
| DELETE | /organization/:orgId                      | requireAuth          | Delete organization                                                                                    |
| GET    | /organization/:orgId/members              | requireAuth          | List org members                                                                                       |
| POST   | /organization/:orgId/members              | requireAuth          | Add member; body: `{ userId, roleIds?: string[] }`                                                     |
| PATCH  | /organization/:orgId/members/:userId      | requireAuth          | Update member roles; body: `{ roleIds: string[] }`                                                     |
| DELETE | /organization/:orgId/members/:userId      | requireAuth          | Remove member                                                                                          |
| GET    | /organization/:orgId/addresses            | requireAuth          | List org addresses; response: `{ data: { addresses, total } }`                                         |
| POST   | /organization/:orgId/addresses            | requireAuth          | Create address; body: `{ label, description?, country?, city?, zipCode?, address?, emails?, phones? }` |
| PATCH  | /organization/:orgId/addresses/:addressId | requireAuth          | Update address (partial); same body fields as create (all optional)                                    |
| DELETE | /organization/:orgId/addresses/:addressId | requireAuth          | Delete address                                                                                         |

## Roles & Permissions (9 routes)

| Method | Path                                                                  | Auth | Description            |
| ------ | --------------------------------------------------------------------- | ---- | ---------------------- |
| GET    | /platform/roles                                                       | None | List all roles         |
| POST   | /platform/roles                                                       | None | Create role            |
| GET    | /platform/roles/:id                                                   | None | Get role               |
| PATCH  | /platform/roles/:id                                                   | None | Update role            |
| DELETE | /platform/roles/:id                                                   | None | Delete role            |
| POST   | /platform/roles/:id/permissions                                       | None | Add permission to role |
| DELETE | /platform/roles/:id/permissions/:permissionId                         | None | Remove permission      |
| POST   | /organization/:orgId/location/:locationId/users/:userId/roles         | None | Assign role to user    |
| DELETE | /organization/:orgId/location/:locationId/users/:userId/roles/:roleId | None | Revoke role            |

## Teams (8 routes)

| Method | Path                                                                | Auth        | Description   |
| ------ | ------------------------------------------------------------------- | ----------- | ------------- |
| GET    | /organization/:orgId/location/:locationId/teams                     | requireAuth | List teams    |
| POST   | /organization/:orgId/location/:locationId/teams                     | requireAuth | Create team   |
| GET    | /organization/:orgId/location/:locationId/teams/:id                 | requireAuth | Get team      |
| PATCH  | /organization/:orgId/location/:locationId/teams/:id                 | requireAuth | Update team   |
| DELETE | /organization/:orgId/location/:locationId/teams/:id                 | requireAuth | Delete team   |
| GET    | /organization/:orgId/location/:locationId/teams/:id/members         | requireAuth | List members  |
| POST   | /organization/:orgId/location/:locationId/teams/:id/members         | requireAuth | Add member    |
| DELETE | /organization/:orgId/location/:locationId/teams/:id/members/:userId | requireAuth | Remove member |

## Patients (18 routes)

| Method | Path                                                                   | Auth        | Description                                   |
| ------ | ---------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| POST   | /organization/:orgId/patients                                          | requireAuth | Create patient                                |
| GET    | /organization/:orgId/patients                                          | requireAuth | List patients (search/filter/sort/pagination) |
| GET    | /organization/:orgId/patients/:patientId                               | requireAuth | Get patient                                   |
| PATCH  | /organization/:orgId/patients/:patientId                               | requireAuth | Update patient                                |
| DELETE | /organization/:orgId/patients/:patientId                               | requireAuth | Deactivate patient                            |
| POST   | /organization/:orgId/patients/:patientId/providers/:userId             | requireAuth | Assign provider                               |
| DELETE | /organization/:orgId/patients/:patientId/providers/:userId             | requireAuth | Unassign provider                             |
| POST   | /organization/:orgId/patients/:patientId/teeth/:toothNumber            | requireAuth | Record tooth status                           |
| GET    | /organization/:orgId/patients/:patientId/teeth/:toothNumber/history    | requireAuth | Tooth history                                 |
| DELETE | /organization/:orgId/patients/:patientId/teeth/:toothNumber            | requireAuth | Reset tooth                                   |
| POST   | /organization/:orgId/patients/:patientId/allergies                     | requireAuth | Add allergy                                   |
| DELETE | /organization/:orgId/patients/:patientId/allergies/:allergyId          | requireAuth | Remove allergy                                |
| POST   | /organization/:orgId/patients/:patientId/conditions                    | requireAuth | Add condition                                 |
| DELETE | /organization/:orgId/patients/:patientId/conditions/:conditionId       | requireAuth | Remove condition                              |
| POST   | /organization/:orgId/patients/:patientId/emergency-contacts            | requireAuth | Add emergency contact                         |
| PATCH  | /organization/:orgId/patients/:patientId/emergency-contacts/:contactId | requireAuth | Update emergency contact                      |
| DELETE | /organization/:orgId/patients/:patientId/emergency-contacts/:contactId | requireAuth | Remove emergency contact                      |

## Assets (10 routes) — @fundus/assets

| Method | Path                                              | Auth        | Description                                |
| ------ | ------------------------------------------------- | ----------- | ------------------------------------------ |
| GET    | /tenant/:tenantId/asset-types                     | requireAuth | List asset types (search/filter/sort/page) |
| POST   | /tenant/:tenantId/asset-types                     | requireAuth | Create asset type                          |
| PATCH  | /tenant/:tenantId/asset-types/:id                 | requireAuth | Update asset type                          |
| DELETE | /tenant/:tenantId/asset-types/:id                 | requireAuth | Delete asset type                          |
| GET    | /tenant/:tenantId/assets                          | requireAuth | List all assets (enriched, cross-location) |
| GET    | /tenant/:tenantId/assets/:id                      | requireAuth | Get single asset                           |
| GET    | /tenant/:tenantId/location/:locationId/assets     | requireAuth | List assets at location                    |
| POST   | /tenant/:tenantId/location/:locationId/assets     | requireAuth | Create asset                               |
| PATCH  | /tenant/:tenantId/location/:locationId/assets/:id | requireAuth | Update asset                               |
| DELETE | /tenant/:tenantId/location/:locationId/assets/:id | requireAuth | Delete asset                               |

## Appointment Types (4 routes)

| Method | Path                                       | Auth        | Description |
| ------ | ------------------------------------------ | ----------- | ----------- |
| GET    | /organization/:orgId/appointment-types     | requireAuth | List types  |
| POST   | /organization/:orgId/appointment-types     | requireAuth | Create type |
| PATCH  | /organization/:orgId/appointment-types/:id | requireAuth | Update type |
| DELETE | /organization/:orgId/appointment-types/:id | requireAuth | Delete type |

## Working Hours — Location (7 routes) — `@fundus/working-hours`

| Method | Path                                                                  | Auth        | Description                  |
| ------ | --------------------------------------------------------------------- | ----------- | ---------------------------- |
| GET    | /organization/:orgId/location/:locationId/working-hours               | requireAuth | Get weekly hours             |
| PUT    | /organization/:orgId/location/:locationId/working-hours/:dayOfWeek    | requireAuth | Set day hours                |
| DELETE | /organization/:orgId/location/:locationId/working-hours/:dayOfWeek    | requireAuth | Clear day hours              |
| GET    | /organization/:orgId/location/:locationId/working-hour-exceptions     | requireAuth | List exceptions (date range) |
| POST   | /organization/:orgId/location/:locationId/working-hour-exceptions     | requireAuth | Add exception                |
| PATCH  | /organization/:orgId/location/:locationId/working-hour-exceptions/:id | requireAuth | Update exception             |
| DELETE | /organization/:orgId/location/:locationId/working-hour-exceptions/:id | requireAuth | Delete exception             |

## Working Hours — User (7 routes) — `@fundus/working-hours`

| Method | Path                                                           | Auth        | Description                  |
| ------ | -------------------------------------------------------------- | ----------- | ---------------------------- |
| GET    | /organization/:orgId/users/:userId/working-hours               | requireAuth | Get weekly hours             |
| PUT    | /organization/:orgId/users/:userId/working-hours/:dayOfWeek    | requireAuth | Set day hours                |
| DELETE | /organization/:orgId/users/:userId/working-hours/:dayOfWeek    | requireAuth | Clear day hours              |
| GET    | /organization/:orgId/users/:userId/working-hour-exceptions     | requireAuth | List exceptions (date range) |
| POST   | /organization/:orgId/users/:userId/working-hour-exceptions     | requireAuth | Add exception                |
| PATCH  | /organization/:orgId/users/:userId/working-hour-exceptions/:id | requireAuth | Update exception             |
| DELETE | /organization/:orgId/users/:userId/working-hour-exceptions/:id | requireAuth | Delete exception             |

## @fundus/calendar — Event Types (5), Events (7), Attendees (3), Resources (3), Recurrence (4), Reminders (3), Availability (1) — 26 routes

See `packages/calendar/src/shared/routes/` for typed route definitions. Registered via `registerCalendarRoutes(app, "/tenant/:tenantId/calendar")`.

| Method | Path                                                             | Auth           | Description               |
| ------ | ---------------------------------------------------------------- | -------------- | ------------------------- |
| GET    | /tenant/:tenantId/calendar/event-types                           | requireAuth    | List event types          |
| GET    | /tenant/:tenantId/calendar/event-types/:eventTypeId              | requireAuth    | Get event type            |
| POST   | /tenant/:tenantId/calendar/event-types                           | requireAuth    | Create event type         |
| PUT    | /tenant/:tenantId/calendar/event-types/:eventTypeId              | requireAuth    | Update event type         |
| DELETE | /tenant/:tenantId/calendar/event-types/:eventTypeId              | requireAuth    | Deactivate event type     |
| GET    | /tenant/:tenantId/calendar/events                                | requireAuth    | List events (time window) |
| GET    | /tenant/:tenantId/calendar/events/:eventId                       | requireAuth    | Get event                 |
| POST   | /tenant/:tenantId/calendar/events                                | requireAuth    | Create event              |
| PUT    | /tenant/:tenantId/calendar/events/:eventId                       | requireAuth    | Update event              |
| DELETE | /tenant/:tenantId/calendar/events/:eventId                       | requireAuth    | Delete event              |
| PATCH  | /tenant/:tenantId/calendar/events/:eventId/status                | requireAuth    | Change status             |
| POST   | /tenant/:tenantId/calendar/events/:eventId/cancel                | requireAuth    | Cancel event              |
| POST   | /tenant/:tenantId/calendar/events/:eventId/attendees             | requireAuth    | Add attendee              |
| DELETE | /tenant/:tenantId/calendar/events/:eventId/attendees/:attendeeId | requireAuth    | Remove attendee           |
| PATCH  | /tenant/:tenantId/calendar/events/:eventId/attendees/:aId/status | requireAuth    | RSVP (self-bypass)        |
| POST   | /tenant/:tenantId/calendar/events/:eventId/resources             | requireAuth    | Add resource              |
| DELETE | /tenant/:tenantId/calendar/events/:eventId/resources/:resourceId | requireAuth    | Remove resource           |
| GET    | /tenant/:tenantId/calendar/resource-conflicts                    | requireAuth    | Check conflicts           |
| POST   | /tenant/:tenantId/calendar/events/:eventId/occurrences/cancel    | requireAuth    | Cancel occurrence         |
| POST   | /tenant/:tenantId/calendar/events/:eventId/occurrences/modify    | requireAuth    | Modify occurrence         |
| POST   | /tenant/:tenantId/calendar/events/:eventId/series/update-future  | requireAuth    | Update series (future)    |
| POST   | /tenant/:tenantId/calendar/events/:eventId/series/update-all     | requireAuth    | Update series (all)       |
| POST   | /tenant/:tenantId/calendar/events/:eventId/reminders             | requireAuth    | Set reminder              |
| DELETE | /tenant/:tenantId/calendar/events/:eventId/reminders/:reminderId | requireAuth    | Remove reminder           |
| POST   | /internal/calendar/process-reminders                             | internalSecret | Process pending (cron)    |
| GET    | /tenant/:tenantId/calendar/available-slots                       | requireAuth    | Find available slots      |

## Procedure Catalog (4 routes)

| Method | Path                                                | Auth        | Description                              |
| ------ | --------------------------------------------------- | ----------- | ---------------------------------------- |
| GET    | /organization/:orgId/procedure-types                | requireAuth | List types (optionally include inactive) |
| POST   | /organization/:orgId/procedure-types                | requireAuth | Create type                              |
| PATCH  | /organization/:orgId/procedure-types/:id            | requireAuth | Update type                              |
| POST   | /organization/:orgId/procedure-types/:id/deactivate | requireAuth | Deactivate type                          |

## Treatments — Procedures (5 routes)

| Method | Path                                                    | Auth        | Description                         |
| ------ | ------------------------------------------------------- | ----------- | ----------------------------------- |
| POST   | /organization/:orgId/patients/:patientId/procedures     | requireAuth | Create procedure                    |
| GET    | /organization/:orgId/patients/:patientId/procedures     | requireAuth | List (type/tooth/date/plan filters) |
| GET    | /organization/:orgId/patients/:patientId/procedures/:id | requireAuth | Get procedure                       |
| PATCH  | /organization/:orgId/patients/:patientId/procedures/:id | requireAuth | Update procedure                    |
| DELETE | /organization/:orgId/patients/:patientId/procedures/:id | requireAuth | Delete procedure                    |

## Treatments — Treatment Plans (5 routes)

| Method | Path                                                         | Auth        | Description              |
| ------ | ------------------------------------------------------------ | ----------- | ------------------------ |
| POST   | /organization/:orgId/patients/:patientId/treatment-plans     | requireAuth | Create plan              |
| GET    | /organization/:orgId/patients/:patientId/treatment-plans     | requireAuth | List plans               |
| GET    | /organization/:orgId/patients/:patientId/treatment-plans/:id | requireAuth | Get plan with procedures |
| PATCH  | /organization/:orgId/patients/:patientId/treatment-plans/:id | requireAuth | Update plan              |
| DELETE | /organization/:orgId/patients/:patientId/treatment-plans/:id | requireAuth | Delete plan              |

## Inventory — Units (4 routes)

| Method | Path                                                | Auth        | Description     |
| ------ | --------------------------------------------------- | ----------- | --------------- |
| GET    | /organization/:orgId/inventory-units                | requireAuth | List units      |
| POST   | /organization/:orgId/inventory-units                | requireAuth | Create unit     |
| PATCH  | /organization/:orgId/inventory-units/:id            | requireAuth | Update unit     |
| POST   | /organization/:orgId/inventory-units/:id/deactivate | requireAuth | Deactivate unit |

## Inventory — Categories (4 routes)

| Method | Path                                                     | Auth        | Description         |
| ------ | -------------------------------------------------------- | ----------- | ------------------- |
| GET    | /organization/:orgId/inventory-categories                | requireAuth | List categories     |
| POST   | /organization/:orgId/inventory-categories                | requireAuth | Create category     |
| PATCH  | /organization/:orgId/inventory-categories/:id            | requireAuth | Update category     |
| POST   | /organization/:orgId/inventory-categories/:id/deactivate | requireAuth | Deactivate category |

## Inventory — Items (5 routes)

| Method | Path                                                | Auth        | Description                                       |
| ------ | --------------------------------------------------- | ----------- | ------------------------------------------------- |
| POST   | /organization/:orgId/inventory-items                | requireAuth | Create item                                       |
| GET    | /organization/:orgId/inventory-items                | requireAuth | List items (search, categoryId, sort, pagination) |
| GET    | /organization/:orgId/inventory-items/:id            | requireAuth | Get item                                          |
| PATCH  | /organization/:orgId/inventory-items/:id            | requireAuth | Update item                                       |
| POST   | /organization/:orgId/inventory-items/:id/deactivate | requireAuth | Deactivate item                                   |

## Inventory — Stock & Movements (3 routes)

| Method | Path                                                           | Auth        | Description                                             |
| ------ | -------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| GET    | /organization/:orgId/inventory-items/:itemId/stock             | requireAuth | Stock levels across locations (?locationId filter)      |
| POST   | /organization/:orgId/locations/:locationId/inventory-movements | requireAuth | Record stock movement (received/used/adjusted/disposed) |
| GET    | /organization/:orgId/locations/:locationId/inventory-movements | requireAuth | List movements (itemId, type, date range, pagination)   |

## Currencies (1 route)

| Method | Path        | Auth        | Description                |
| ------ | ----------- | ----------- | -------------------------- |
| GET    | /currencies | requireAuth | List all active currencies |

## Timezones (1 route)

| Method | Path       | Auth        | Description               |
| ------ | ---------- | ----------- | ------------------------- |
| GET    | /timezones | requireAuth | List all active timezones |

## PlatformAdmin Users (6 routes)

| Method | Path                                                    | Auth                 | Description                                        |
| ------ | ------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| GET    | /platform/users                                         | requirePlatformAdmin | List users (search/filter/sort/pagination)         |
| GET    | /platform/users/:id                                     | requirePlatformAdmin | Get user                                           |
| POST   | /platform/users                                         | requirePlatformAdmin | Create user (sends invite)                         |
| PATCH  | /platform/users/:id                                     | requirePlatformAdmin | Update user (all fields including isPlatformAdmin) |
| POST   | /platform/users/:id/password-reset                      | requirePlatformAdmin | Trigger password reset email for user              |
| GET    | /platform/organizations/:organizationId/available-users | requirePlatformAdmin | list users not in org (search, sort, pagination)   |

## Announcements — Org-Scoped (6 routes)

| Method | Path                                               | Auth        | Description                                            |
| ------ | -------------------------------------------------- | ----------- | ------------------------------------------------------ |
| POST   | /organization/:orgId/announcements                 | requireAuth | Create announcement (org-owned, isGlobal=false)        |
| GET    | /organization/:orgId/announcements                 | requireAuth | List org announcements (search/severity/status/sort)   |
| GET    | /organization/:orgId/announcements/active          | requireAuth | Get active banners (global + org-targeted, any member) |
| GET    | /organization/:orgId/announcements/:announcementId | requireAuth | Get announcement                                       |
| PATCH  | /organization/:orgId/announcements/:announcementId | requireAuth | Update announcement                                    |
| DELETE | /organization/:orgId/announcements/:announcementId | requireAuth | Delete announcement                                    |

## Announcements — PlatformAdmin (5 routes)

| Method | Path                                    | Auth                 | Description                                                   |
| ------ | --------------------------------------- | -------------------- | ------------------------------------------------------------- |
| POST   | /platform/announcements                 | requirePlatformAdmin | Create announcement (global or multi-org targeted)            |
| GET    | /platform/announcements                 | requirePlatformAdmin | List all announcements (search/severity/status/sort)          |
| GET    | /platform/announcements/:announcementId | requirePlatformAdmin | Get announcement with target org IDs + names                  |
| PATCH  | /platform/announcements/:announcementId | requirePlatformAdmin | Update announcement (replace junction rows if targets change) |
| DELETE | /platform/announcements/:announcementId | requirePlatformAdmin | Delete announcement + junction rows                           |

## Audit Logs — PlatformAdmin (9 routes)

| Method | Path                                              | Auth                 | Description                                                       |
| ------ | ------------------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| GET    | /platform/audit-logs                              | requirePlatformAdmin | List audit logs (search/type/action/feature/entityType/user/date) |
| GET    | /platform/audit-logs/prune-preview                | requirePlatformAdmin | Preview prune — returns count + confirmation code                 |
| POST   | /platform/audit-logs/prune                        | requirePlatformAdmin | Execute prune with confirmation code                              |
| GET    | /platform/audit-logs/verify                       | requirePlatformAdmin | Verify audit chain integrity (optional organizationId query)      |
| GET    | /platform/audit-logs/:id                          | requirePlatformAdmin | Get single audit log entry                                        |
| DELETE | /platform/audit-logs/:id                          | requirePlatformAdmin | Delete single audit log entry                                     |
| GET    | /platform/audit-logs/export                       | requirePlatformAdmin | Export audit logs (CSV or JSON)                                   |
| GET    | /platform/audit-logs/entity/:entityType/:entityId | requirePlatformAdmin | Get entity timeline (all changes for a specific entity)           |
| GET    | /platform/audit-logs/facets                       | requirePlatformAdmin | Get distinct feature and entityType values for filter dropdowns   |

## Audit Logs — Org-Scoped (6 routes)

| Method | Path                                                         | Auth        | Description                                               |
| ------ | ------------------------------------------------------------ | ----------- | --------------------------------------------------------- |
| GET    | /organization/:orgId/audit-logs                              | requireAuth | List org-scoped audit logs (same filters, limited to org) |
| GET    | /organization/:orgId/audit-logs/:id                          | requireAuth | Get single audit log entry (org-scoped)                   |
| DELETE | /organization/:orgId/audit-logs/:id                          | requireAuth | Delete single audit log entry (org-scoped)                |
| GET    | /organization/:orgId/audit-logs/export                       | requireAuth | Export org audit logs (CSV or JSON)                       |
| GET    | /organization/:orgId/audit-logs/entity/:entityType/:entityId | requireAuth | Get entity timeline scoped to org                         |
| GET    | /organization/:orgId/audit-logs/facets                       | requireAuth | Get distinct feature and entityType values (org-scoped)   |

## Error Logs — PlatformAdmin (5 routes)

| Method | Path                               | Auth                 | Description                                                 |
| ------ | ---------------------------------- | -------------------- | ----------------------------------------------------------- |
| GET    | /platform/error-logs               | requirePlatformAdmin | List error logs (search/severity/source/org/user/date/sort) |
| GET    | /platform/error-logs/prune-preview | requirePlatformAdmin | Preview prune — returns count + confirmation code           |
| POST   | /platform/error-logs/prune         | requirePlatformAdmin | Execute prune with confirmation code                        |
| GET    | /platform/error-logs/:errorLogId   | requirePlatformAdmin | Get single error log detail                                 |
| DELETE | /platform/error-logs/:errorLogId   | requirePlatformAdmin | Delete single error log                                     |

## Sessions — Unified (3 routes, @fundus/sessions)

| Method | Path                           | Auth        | Description                                                                                   |
| ------ | ------------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| GET    | /sessions                      | requireAuth | List sessions (search/tenantId/status/sort/order/limit/offset + UA enrichment, tenant-scoped) |
| POST   | /sessions/:sessionId/terminate | requireAuth | Terminate session (tenant access verified, platform admin can terminate any)                  |
| GET    | /sessions/export               | requireAuth | Export sessions (format=csv\|json, same filters as list, CSV formula-injection sanitized)     |

## Files — Org Upload Lifecycle (5 routes)

| Method | Path                                                  | Auth        | Description                                                                               |
| ------ | ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| POST   | /organization/:orgId/files/uploads/init               | requireAuth | Initiate chunked upload — returns uploadId, chunkSize; validates totalSize vs maxFileSize |
| POST   | /organization/:orgId/files/uploads/:uploadId/chunk    | requireAuth | Upload a single chunk (multipart/form-data); query: chunkIndex; returns chunksRemaining   |
| GET    | /organization/:orgId/files/uploads/:uploadId/status   | requireAuth | Get upload status — received chunks, chunkSize                                            |
| POST   | /organization/:orgId/files/uploads/:uploadId/finalize | requireAuth | Finalize upload — assembles chunks, moves to permanent storage                            |
| GET    | /organization/:orgId/files/uploads                    | requireAuth | List pending uploads (status=pending); sort/pagination                                    |

## Files — Org CRUD (6 routes)

| Method | Path                                     | Auth        | Description                                             |
| ------ | ---------------------------------------- | ----------- | ------------------------------------------------------- |
| GET    | /organization/:orgId/files               | requireAuth | List files (search/mimeType/entityType/sort/pagination) |
| GET    | /organization/:orgId/files/:id           | requireAuth | Get file metadata                                       |
| GET    | /organization/:orgId/files/:id/download  | requireAuth | Download file content (binary stream)                   |
| GET    | /organization/:orgId/files/:id/thumbnail | requireAuth | Download thumbnail (resized image); 404 if not image    |
| PATCH  | /organization/:orgId/files/:id           | requireAuth | Update file metadata (name, description, tags)          |
| DELETE | /organization/:orgId/files/:id           | requireAuth | Delete file + chunks from storage                       |

## Files — Org Entity Linking (3 routes)

| Method | Path                                                      | Auth        | Description                                            |
| ------ | --------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| POST   | /organization/:orgId/files/:id/links                      | requireAuth | Link file to an entity; body: { entityType, entityId } |
| DELETE | /organization/:orgId/files/:id/links/:linkId              | requireAuth | Unlink file from entity                                |
| GET    | /organization/:orgId/entities/:entityType/:entityId/files | requireAuth | List all files linked to a given entity                |

## Files — Org Shares (4 routes)

| Method | Path                                               | Auth        | Description                                                           |
| ------ | -------------------------------------------------- | ----------- | --------------------------------------------------------------------- |
| POST   | /organization/:orgId/files/:fileId/shares          | requireAuth | Create share link; body: { expiresAt?, maxAccesses?, oauthRequired? } |
| GET    | /organization/:orgId/file-shares                   | requireAuth | List share links (search/fileId/status/sort/pagination)               |
| GET    | /organization/:orgId/file-shares/:shareId/accesses | requireAuth | List accesses for a share link                                        |
| DELETE | /organization/:orgId/file-shares/:shareId          | requireAuth | Revoke share link                                                     |

## Files — Org Purge (2 routes)

| Method | Path                               | Auth        | Description                                                                               |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| POST   | /tenant/:tenantId/files/purge      | requireAuth | Hard-delete all soft-deleted files + expired uploads for the tenant; requires files:purge |
| POST   | /tenant/:tenantId/files/purge-mine | requireAuth | Hard-delete own soft-deleted files + expired uploads; requires files:purgeOwn             |

## Files — Org Restore (2 routes)

| Method | Path                                     | Auth        | Description                                                        |
| ------ | ---------------------------------------- | ----------- | ------------------------------------------------------------------ |
| POST   | /tenant/:tenantId/files/:id/restore      | requireAuth | Restore a soft-deleted file for the tenant; requires files:restore |
| POST   | /tenant/:tenantId/files/:id/restore-mine | requireAuth | Restore own soft-deleted file; requires files:restoreOwn           |

## Files — PlatformAdmin Upload Monitoring (2 routes)

| Method | Path                                        | Auth                 | Description                                             |
| ------ | ------------------------------------------- | -------------------- | ------------------------------------------------------- |
| GET    | /platform/files/uploads                     | requirePlatformAdmin | List platform pending uploads (status=pending)          |
| GET    | /platform/files/uploads/by-tenant/:tenantId | requirePlatformAdmin | List tenant pending uploads for debugging stuck uploads |

## Files — PlatformAdmin CRUD (6 routes)

| Method | Path                          | Auth                 | Description                                          |
| ------ | ----------------------------- | -------------------- | ---------------------------------------------------- |
| GET    | /platform/files               | requirePlatformAdmin | List all platform files (search/orgId/mimeType/sort) |
| GET    | /platform/files/:id           | requirePlatformAdmin | Get file metadata                                    |
| GET    | /platform/files/:id/download  | requirePlatformAdmin | Download file content (binary stream)                |
| GET    | /platform/files/:id/thumbnail | requirePlatformAdmin | Download thumbnail; 404 if not image                 |
| PATCH  | /platform/files/:id           | requirePlatformAdmin | Update file metadata (name, description, tags)       |
| DELETE | /platform/files/:id           | requirePlatformAdmin | Delete file + chunks from storage                    |

## Files — PlatformAdmin Shares (4 routes)

| Method | Path                                    | Auth                 | Description                                               |
| ------ | --------------------------------------- | -------------------- | --------------------------------------------------------- |
| POST   | /platform/files/:fileId/shares          | requirePlatformAdmin | Create share link for platform file                       |
| GET    | /platform/file-shares                   | requirePlatformAdmin | List all platform share links (search/fileId/status/sort) |
| GET    | /platform/file-shares/:shareId/accesses | requirePlatformAdmin | List accesses for a platform share link                   |
| DELETE | /platform/file-shares/:shareId          | requirePlatformAdmin | Revoke platform share link                                |

## Platform Settings (4 routes)

| Method | Path                              | Auth                 | Description                                                      |
| ------ | --------------------------------- | -------------------- | ---------------------------------------------------------------- |
| GET    | /settings                         | requireAuth          | List all settings groups (includeTenantOverrides requires admin) |
| PUT    | /settings/:group                  | requirePlatformAdmin | Save global settings for a group                                 |
| PUT    | /settings/:group/tenant/:tenantId | requirePlatformAdmin | Save tenant-specific settings override                           |
| DELETE | /settings/:group/tenant-overrides | requirePlatformAdmin | Clear all tenant overrides for a settings group                  |

## Files — PlatformAdmin Purge (1 route)

| Method | Path                  | Auth                 | Description                                                                                                  |
| ------ | --------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | /platform/files/purge | requirePlatformAdmin | Hard-delete soft-deleted files + expire/purge stale uploads; no body; returns { purgedFiles, purgedUploads } |

## Files — Public (3 routes)

| Method | Path                                         | Auth | Description                                                        |
| ------ | -------------------------------------------- | ---- | ------------------------------------------------------------------ |
| GET    | /public/files/:token                         | None | Access shared file — validates token, logs access, streams content |
| GET    | /public/files/:token/auth/:provider          | None | Start OAuth flow for OAuth-protected share link                    |
| GET    | /public/files/:token/auth/:provider/callback | None | Handle OAuth callback, validate, redirect back to file             |

## Utility

| Method | Path    | Auth | Description  |
| ------ | ------- | ---- | ------------ |
| GET    | /health | None | Health check |

## SessionUser Shape (from /auth/me)

```
SessionUser {
  id, email, firstName, lastName, isPlatformAdmin, isActive,
  impersonatedByUserId?,
  memberships: [{
    organizationId, isRootAdmin, teamIds: string[],
    roles: [{ id, name, isSystem, permissions: [{ feature, action, scope }] }]
  }]
}
```
