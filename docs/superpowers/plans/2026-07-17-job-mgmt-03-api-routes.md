# Job Management 03 — API Routes for Global Job List + Cancel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/jobs` and `POST /api/jobs/:jobId/cancel` routes with shared Zod definitions.

**Architecture:** New route definitions in `src/shared/routes/jobs.ts` (reuse existing `jobSchema`). Handlers in `src/api/routes/jobs.ts` call `jobWorker.listAllJobs` and `jobWorker.cancelJob`.

**Tech Stack:** Fastify, Zod, registerRoute pattern

## Global Constraints

- TypeScript 7 strict, ESM
- Routes use `defineRoute` + `registerRoute` pattern
- Response helpers: `sendList`, `sendNone`, `sendError`
- Route tests use Fastify `app.inject`

---

### Task 1: Shared Route Definitions + API Handlers

**Files:**

- Modify: `src/shared/routes/jobs.ts` — add `listAllJobsRoute`, `cancelJobRoute` (reuse existing `jobSchema` at line 4)
- Modify: `src/api/routes/jobs.ts` — add handlers, import `sendNone` + new routes
- Test: `src/api/routes/__tests__/jobs.test.ts`

**Interfaces:**

- Consumes: `JobWorker.listAllJobs(status?)`, `JobWorker.cancelJob(jobId)` from plan 02
- Produces: `listAllJobsRoute`, `cancelJobRoute` exported from `#shared/routes/index.js` (barrel already re-exports `./jobs.js`)

- [ ] **Step 1: Add route definitions to `src/shared/routes/jobs.ts`**

Append after existing routes:

```typescript
export const listAllJobsRoute = defineRoute({
  method: "GET",
  path: "/api/jobs",
  description: "List all jobs across all projects",
  params: z.object({}),
  querystring: z.object({ status: z.string().optional() }),
  response: z.object({ items: z.array(jobSchema), total: z.number() })
});

export const cancelJobRoute = defineRoute({
  method: "POST",
  path: "/api/jobs/:jobId/cancel",
  description: "Cancel or kill a job",
  params: z.object({ jobId: z.string() }),
  response: z.object({ success: z.boolean() })
});
```

- [ ] **Step 2: Write failing route tests**

Add to `src/api/routes/__tests__/jobs.test.ts`:

```typescript
describe("GET /api/jobs", () => {
  it("returns all jobs across all projects", async () => {
    // seed project(s), enqueue jobs via jobWorker
    const response = await app.inject({ method: "GET", url: "/api/jobs" });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.total).toBe(body.items.length);
  });

  it("filters jobs by status query parameter", async () => {
    // enqueue + process one job to completion, enqueue another
    const response = await app.inject({ method: "GET", url: "/api/jobs?status=pending" });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.every((j: { status: string }) => j.status === "pending")).toBe(true);
  });
});

describe("POST /api/jobs/:jobId/cancel", () => {
  it("cancels a pending job and returns 200", async () => {
    const jobId = await jobWorker.enqueue({
      projectId: "p1",
      type: "dependency",
      packages: [{ name: "react", from: "18.0.0", to: "19.0.0" }]
    });

    const response = await app.inject({ method: "POST", url: `/api/jobs/${jobId}/cancel` });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: true });
    expect((await jobWorker.getJob(jobId))!.status).toBe("cancelled");
  });

  it("returns 404 for an unknown jobId", async () => {
    const response = await app.inject({ method: "POST", url: "/api/jobs/nonexistent/cancel" });
    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn test src/api/routes/__tests__/jobs.test.ts`
Expected: FAIL — routes not registered

- [ ] **Step 4: Add handlers to `src/api/routes/jobs.ts`**

Add `sendNone` to imports, add `listAllJobsRoute` and `cancelJobRoute` to route imports. Add handlers:

```typescript
registerRoute(app, listAllJobsRoute, {}, async (request, reply) => {
  const jobs = await jobWorker.listAllJobs(request.query.status);
  sendList(reply, jobs, jobs.length);
});

registerRoute(app, cancelJobRoute, {}, async (request, reply) => {
  const { jobId } = request.params;
  const job = await jobWorker.getJob(jobId);
  if (!job) {
    sendError(reply, 404, "Job not found");
    return;
  }
  await jobWorker.cancelJob(jobId);
  sendNone(reply);
});
```

- [ ] **Step 5: Run all route tests**

Run: `yarn test src/api/routes/__tests__/jobs.test.ts`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/routes/jobs.ts src/api/routes/jobs.ts src/api/routes/__tests__/jobs.test.ts
git commit -m "feat: add GET /api/jobs and POST /api/jobs/:jobId/cancel routes"
```
