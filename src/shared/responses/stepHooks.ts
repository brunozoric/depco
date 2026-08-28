import { z } from "zod";

export const discoveredScriptSchema = z.object({
    name: z.string(),
    command: z.string()
});

export const stepHookSchema = z.object({
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

export const listStepHooksResponseSchema = z.object({
    items: z.array(stepHookSchema),
    configSource: z.enum(["db", "file"]),
    discoveredScripts: z.array(discoveredScriptSchema)
});

export const createStepHookResponseSchema = z.object({ item: stepHookSchema });

export const updateStepHookResponseSchema = z.object({ item: stepHookSchema });

export const deleteStepHookResponseSchema = z.object({ deleted: z.boolean() });
