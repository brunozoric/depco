import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const discoveredScriptSchema = z.object({
    name: z.string(),
    command: z.string()
});

const stepHookSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    position: z.string(),
    name: z.string(),
    command: z.string(),
    type: z.enum(["command", "script", "package-script"]),
    required: z.boolean(),
    enabled: z.boolean(),
    sortOrder: z.number(),
    source: z.enum(["db", "file", "package-json"]),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const listStepHooksRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/step-hooks",
    description: "List step hooks for a project",
    params: z.object({ id: z.string() }),
    querystring: z.object({}),
    response: z.object({
        items: z.array(stepHookSchema),
        configSource: z.enum(["db", "file"]),
        discoveredScripts: z.array(discoveredScriptSchema)
    })
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
    response: z.object({ item: stepHookSchema })
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
    response: z.object({ item: stepHookSchema })
});

export const deleteStepHookRoute = defineRoute({
    method: "DELETE",
    path: "/api/projects/:id/step-hooks/:hookId",
    description: "Delete a step hook",
    params: z.object({ id: z.string(), hookId: z.string() }),
    body: z.object({}),
    response: z.object({ deleted: z.boolean() })
});
