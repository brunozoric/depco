import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    listStepHooksResponseSchema,
    createStepHookResponseSchema,
    updateStepHookResponseSchema,
    deleteStepHookResponseSchema
} from "../responses/stepHooks.js";

export const listStepHooksRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/step-hooks",
    description: "List step hooks for a project",
    params: z.object({ id: z.string() }),
    querystring: z.object({}),
    response: listStepHooksResponseSchema
});

export const createStepHookRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/step-hooks",
    description: "Create a step hook for a project",
    params: z.object({ id: z.string() }),
    body: z.object({
        position: z.string(),
        name: z.string(),
        command: z.string(),
        type: z.enum(["command", "script", "package-script"]),
        required: z.boolean().default(false)
    }),
    response: createStepHookResponseSchema
});

export const updateStepHookRoute = defineRoute({
    method: "PUT",
    path: "/api/projects/:id/step-hooks/:hookId",
    description: "Update a step hook",
    params: z.object({ id: z.string(), hookId: z.string() }),
    body: z.object({
        name: z.string().optional(),
        command: z.string().optional(),
        type: z.enum(["command", "script", "package-script"]).optional(),
        required: z.boolean().optional(),
        enabled: z.boolean().optional(),
        sortOrder: z.number().optional()
    }),
    response: updateStepHookResponseSchema
});

export const deleteStepHookRoute = defineRoute({
    method: "DELETE",
    path: "/api/projects/:id/step-hooks/:hookId",
    description: "Delete a step hook",
    params: z.object({ id: z.string(), hookId: z.string() }),
    body: z.object({}),
    response: deleteStepHookResponseSchema
});
