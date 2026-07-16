import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const appSettingSchema = z.object({
    key: z.string(),
    value: z.string()
});

const configErrorSchema = z
    .object({
        type: z.enum(["json", "schema"]),
        message: z.string()
    })
    .optional();

export const listAppSettingsRoute = defineRoute({
    method: "GET",
    path: "/api/settings/app",
    description: "List all app settings",
    params: z.object({}),
    querystring: z.object({}),
    response: z.object({
        items: z.array(appSettingSchema),
        total: z.number(),
        configSource: z.enum(["db", "file", "error"]),
        fileManaged: z.array(z.string()),
        configError: configErrorSchema
    })
});

export const upsertAppSettingRoute = defineRoute({
    method: "PUT",
    path: "/api/settings/app/:key",
    description: "Create or update an app setting",
    params: z.object({ key: z.string() }),
    body: z.object({ value: z.string() }),
    response: z.object({
        item: appSettingSchema
    })
});
