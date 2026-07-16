import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const stepStateSchema = z.object({
    type: z.string(),
    status: z.enum(["pending", "active", "completed", "skipped"]),
    input: z.record(z.string(), z.unknown()),
    result: z.record(z.string(), z.unknown())
});

const sessionSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    status: z.string(),
    currentStep: z.string(),
    steps: z.array(stepStateSchema),
    stepOrder: z.array(z.string()),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const createUpgradeSessionRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions",
    description: "Create a new upgrade session for a project",
    params: z.object({ id: z.string() }),
    body: z.object({}),
    response: z.object({ item: sessionSchema })
});

export const getUpgradeSessionRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/upgrade-sessions/:sessionId",
    description: "Get an upgrade session by id",
    params: z.object({ id: z.string(), sessionId: z.string() }),
    querystring: z.object({}),
    response: z.object({ item: sessionSchema })
});

export const executeUpgradeStepRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions/:sessionId/steps/:stepType/execute",
    description: "Execute the current step of an upgrade session",
    params: z.object({ id: z.string(), sessionId: z.string(), stepType: z.string() }),
    body: z.record(z.string(), z.unknown()),
    response: z.object({ item: sessionSchema })
});

export const skipUpgradeStepRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions/:sessionId/steps/:stepType/skip",
    description: "Skip the current step of an upgrade session",
    params: z.object({ id: z.string(), sessionId: z.string(), stepType: z.string() }),
    body: z.object({}),
    response: z.object({ item: sessionSchema })
});

export const abortUpgradeSessionRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions/:sessionId/abort",
    description: "Abort an upgrade session",
    params: z.object({ id: z.string(), sessionId: z.string() }),
    body: z.object({}),
    response: z.object({ item: sessionSchema })
});
