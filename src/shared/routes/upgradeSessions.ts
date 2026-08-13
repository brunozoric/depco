import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    createUpgradeSessionResponseSchema,
    getUpgradeSessionResponseSchema,
    executeUpgradeStepResponseSchema,
    skipUpgradeStepResponseSchema,
    abortUpgradeSessionResponseSchema
} from "../responses/upgradeSessions.js";

export const createUpgradeSessionRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions",
    description: "Create a new upgrade session for a project",
    params: z.object({ id: z.string() }),
    body: z.object({}),
    response: createUpgradeSessionResponseSchema
});

export const getUpgradeSessionRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/upgrade-sessions/:sessionId",
    description: "Get an upgrade session by id",
    params: z.object({ id: z.string(), sessionId: z.string() }),
    querystring: z.object({}),
    response: getUpgradeSessionResponseSchema
});

export const executeUpgradeStepRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions/:sessionId/steps/:stepType/execute",
    description: "Execute the current step of an upgrade session",
    params: z.object({ id: z.string(), sessionId: z.string(), stepType: z.string() }),
    body: z.record(z.string(), z.unknown()),
    response: executeUpgradeStepResponseSchema
});

export const skipUpgradeStepRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions/:sessionId/steps/:stepType/skip",
    description: "Skip the current step of an upgrade session",
    params: z.object({ id: z.string(), sessionId: z.string(), stepType: z.string() }),
    body: z.object({}),
    response: skipUpgradeStepResponseSchema
});

export const abortUpgradeSessionRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/upgrade-sessions/:sessionId/abort",
    description: "Abort an upgrade session",
    params: z.object({ id: z.string(), sessionId: z.string() }),
    body: z.object({}),
    response: abortUpgradeSessionResponseSchema
});
